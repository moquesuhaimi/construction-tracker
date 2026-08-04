@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* Custom scrollbar for webkit browsers */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #1f2937;
}

::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 768px) {
  button, input, select, textarea {
    min-height: 44px;
  }
  
  /* Ensure content doesn't get hidden behind floating footer */
  body {
    padding-bottom: env(safe-area-inset-bottom);
  }
}