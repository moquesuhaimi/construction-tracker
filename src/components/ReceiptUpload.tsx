import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Eye, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface ReceiptUploadProps {
  onReceiptProcessed: (data: { amount?: number; receiptNumber?: string; imageUrl: string }) => void;
  onClose: () => void;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ onReceiptProcessed, onClose }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [extractedData, setExtractedData] = useState<{ amount?: number; receiptNumber?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (imageUrl: string) => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });

      const text = result.data.text;
      console.log('Extracted text:', text);

      // Extract amount using various patterns
      const amountPatterns = [
        /(?:total|amount|sum|subtotal|grand total)[\s:]*\$?(\d+\.?\d*)/i,
        /\$(\d+\.?\d*)/g,
        /(\d+\.\d{2})/g,
        /(?:^|\s)(\d+\.?\d*)\s*(?:$|usd|dollars?)/i
      ];

      let extractedAmount: number | undefined;
      
      for (const pattern of amountPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          // For global patterns, get all matches and find the largest (likely the total)
          if (pattern.global) {
            const amounts = matches.map(match => {
              const num = parseFloat(match.replace('$', ''));
              return isNaN(num) ? 0 : num;
            }).filter(num => num > 0);
            
            if (amounts.length > 0) {
              extractedAmount = Math.max(...amounts);
              break;
            }
          } else {
            const match = matches[1] || matches[0];
            const num = parseFloat(match.replace('$', ''));
            if (!isNaN(num) && num > 0) {
              extractedAmount = num;
              break;
            }
          }
        }
      }

      // Extract receipt number
      const receiptPatterns = [
        /(?:receipt|ref|reference|invoice|order)[\s#:]*([a-zA-Z0-9]+)/i,
        /#([a-zA-Z0-9]+)/,
        /(?:^|\s)([A-Z0-9]{6,})/
      ];

      let extractedReceiptNumber: string | undefined;
      
      for (const pattern of receiptPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          extractedReceiptNumber = match[1];
          break;
        }
      }

      const data = {
        amount: extractedAmount,
        receiptNumber: extractedReceiptNumber
      };

      setExtractedData(data);
      
      if (!extractedAmount && !extractedReceiptNumber) {
        setError('Could not extract amount or receipt number from the image. You can still use the image and enter details manually.');
      }

    } catch (err) {
      console.error('OCR Error:', err);
      setError('Failed to process the receipt image. You can still use the image and enter details manually.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Lazy-load OpenCV.js (only when someone actually scans a receipt) so we
  // can find the document's edges and straighten it, like a scanner app.
  const loadOpenCv = (): Promise<any> => {
    const w = window as any;
    if (w.cv?.Mat) return Promise.resolve(w.cv);
    if (!w.__openCvLoadPromise) {
      w.__openCvLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js/dist/opencv.js';
        script.async = true;
        script.onload = () => {
          const cv = (window as any).cv;
          if (!cv) {
            reject(new Error('OpenCV failed to load'));
            return;
          }
          if (cv.Mat) {
            resolve(cv);
          } else {
            cv.onRuntimeInitialized = () => resolve(cv);
          }
        };
        script.onerror = () => reject(new Error('Could not load OpenCV script'));
        document.head.appendChild(script);
      });
    }
    return w.__openCvLoadPromise;
  };

  // Never let cropping hang the UI - if it takes too long (slow connection,
  // first-time library download, etc), just fall back and move on.
  const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(fallback);
        }
      }, ms);
      promise
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(fallback);
          }
        });
    });
  };

  const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // Given 4 corner points in any order, sort them into
  // [top-left, top-right, bottom-right, bottom-left].
  const orderQuadPoints = (pts: number[][]): number[][] => {
    const sums = pts.map((p) => p[0] + p[1]);
    const diffs = pts.map((p) => p[0] - p[1]);
    const tl = pts[sums.indexOf(Math.min(...sums))];
    const br = pts[sums.indexOf(Math.max(...sums))];
    const tr = pts[diffs.indexOf(Math.max(...diffs))];
    const bl = pts[diffs.indexOf(Math.min(...diffs))];
    return [tl, tr, br, bl];
  };

  // Detect the receipt/document's 4 edges and warp them flat, cropping out
  // the background (table, hand, etc). Fully automatic - if a confident
  // document edge can't be found, this just returns the original photo
  // untouched rather than risk a bad crop.
  const autoCropDocument = async (dataUrl: string): Promise<string> => {
    let cv: any;
    try {
      cv = await loadOpenCv();
    } catch (err) {
      console.error('OpenCV unavailable, skipping auto-crop', err);
      return dataUrl;
    }

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not load image for cropping'));
      el.src = dataUrl;
    });

    let src, gray, blurred, edges, dilated, contours, hierarchy, kernel;
    try {
      src = cv.imread(img);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      edges = new cv.Mat();
      cv.Canny(blurred, edges, 50, 150);
      kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      dilated = new cv.Mat();
      cv.dilate(edges, dilated, kernel);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      const imageArea = src.rows * src.cols;
      let bestQuad: number[][] | null = null;
      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          const area = Math.abs(cv.contourArea(approx));
          // Require the detected shape to cover a meaningful chunk of the
          // photo - otherwise it's probably noise, not the receipt itself.
          if (area > bestArea && area > imageArea * 0.2) {
            bestArea = area;
            const pts: number[][] = [];
            for (let j = 0; j < 4; j++) {
              pts.push([approx.data32S[j * 2], approx.data32S[j * 2 + 1]]);
            }
            bestQuad = pts;
          }
        }
        approx.delete();
        cnt.delete();
      }

      if (!bestQuad) return dataUrl;

      const [tl, tr, br, bl] = orderQuadPoints(bestQuad);
      const outWidth = Math.round(Math.max(distance(tl, tr), distance(bl, br)));
      const outHeight = Math.round(Math.max(distance(tl, bl), distance(tr, br)));

      if (outWidth < 50 || outHeight < 50) return dataUrl;

      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl[0], tl[1], tr[0], tr[1], br[0], br[1], bl[0], bl[1],
      ]);
      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, outWidth, 0, outWidth, outHeight, 0, outHeight,
      ]);
      const M = cv.getPerspectiveTransform(srcTri, dstTri);
      const dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, new cv.Size(outWidth, outHeight));

      const canvas = document.createElement('canvas');
      cv.imshow(canvas, dst);
      const result = canvas.toDataURL('image/jpeg', 0.92);

      srcTri.delete();
      dstTri.delete();
      M.delete();
      dst.delete();

      return result;
    } catch (err) {
      console.error('Auto-crop failed, using original image', err);
      return dataUrl;
    } finally {
      src?.delete();
      gray?.delete();
      blurred?.delete();
      edges?.delete();
      dilated?.delete();
      kernel?.delete();
      contours?.delete();
      hierarchy?.delete();
    }
  };

  // Resize + re-compress the photo so a multi-MB camera shot becomes a small,
  // still-readable JPEG before it ever gets stored (as base64 text in the DB).
  const compressImage = (dataUrl: string, maxDimension = 1600, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not process image'));
      img.src = dataUrl;
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size too large. Please select an image under 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawImageUrl = e.target?.result as string;
        setIsCropping(true);
        try {
          const croppedUrl = await withTimeout(autoCropDocument(rawImageUrl), 12000, rawImageUrl);
          const imageUrl = await compressImage(croppedUrl);
          setIsCropping(false);
          setSelectedImage(imageUrl);
          processImage(imageUrl);
        } catch {
          // Fall back to the original image if crop/compression fails for any reason
          setIsCropping(false);
          setSelectedImage(rawImageUrl);
          processImage(rawImageUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUseReceipt = () => {
    if (selectedImage) {
      onReceiptProcessed({
        ...extractedData,
        imageUrl: selectedImage
      });
    }
  };

  const handleRetry = () => {
    if (selectedImage) {
      processImage(selectedImage);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Upload Receipt</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {!selectedImage ? isCropping ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 text-yellow-500 animate-spin mb-4" />
            <p className="text-white font-medium">Cropping & straightening receipt...</p>
            <p className="text-gray-400 text-sm mt-1">First scan may take a few seconds while tools load</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-center mb-6">
              Upload a receipt image to automatically extract amount and receipt number
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Camera Input */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-600 rounded-lg hover:border-yellow-500 transition-colors"
              >
                <Camera className="h-12 w-12 text-gray-400 mb-4" />
                <span className="text-white font-medium">Take Photo</span>
                <span className="text-gray-400 text-sm">Use camera</span>
              </button>

              {/* Gallery Input */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-600 rounded-lg hover:border-yellow-500 transition-colors"
              >
                <Upload className="h-12 w-12 text-gray-400 mb-4" />
                <span className="text-white font-medium">Upload Image</span>
                <span className="text-gray-400 text-sm">From gallery</span>
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="text-xs text-gray-400 text-center mt-4">
              <p>• Supported formats: JPG, PNG, WebP</p>
              <p>• Maximum file size: 10MB</p>
              <p>• For best results, ensure receipt text is clear and well-lit</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Image Preview */}
            <div className="relative">
              <img
                src={selectedImage}
                alt="Receipt"
                className="w-full max-h-64 object-contain rounded-lg bg-gray-900"
              />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setExtractedData(null);
                  setError(null);
                  setIsProcessing(false);
                }}
                className="absolute top-2 right-2 bg-gray-800 bg-opacity-80 text-white p-2 rounded-full hover:bg-opacity-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Processing Status */}
            {isProcessing && (
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                  <span className="text-white font-medium">Processing receipt...</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-gray-400 text-sm mt-2">{progress}% complete</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-400">{error}</span>
                </div>
                <button
                  onClick={handleRetry}
                  className="mt-3 text-red-400 hover:text-red-300 text-sm underline"
                >
                  Try processing again
                </button>
              </div>
            )}

            {/* Extracted Data */}
            {extractedData && !isProcessing && (
              <div className="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-400 font-medium">Receipt processed successfully!</span>
                </div>
                
                <div className="space-y-2">
                  {extractedData.amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Amount:</span>
                      <span className="text-white font-medium">${extractedData.amount.toFixed(2)}</span>
                    </div>
                  )}
                  {extractedData.receiptNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Receipt Number:</span>
                      <span className="text-white font-medium">{extractedData.receiptNumber}</span>
                    </div>
                  )}
                  {!extractedData.amount && !extractedData.receiptNumber && (
                    <p className="text-gray-400 text-sm">
                      No amount or receipt number detected. You can still use the image.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleUseReceipt}
                disabled={isProcessing}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black disabled:text-gray-400 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Use This Receipt
              </button>
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setExtractedData(null);
                  setError(null);
                  setIsProcessing(false);
                }}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                Choose Different Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};