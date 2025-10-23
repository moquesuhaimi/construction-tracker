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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size too large. Please select an image under 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setSelectedImage(imageUrl);
        processImage(imageUrl);
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

        {!selectedImage ? (
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