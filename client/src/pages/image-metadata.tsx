//client/src/pages/image-metadata.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Image, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Info, 
  FileImage, 
  RefreshCw, 
  Filter, 
  Settings, 
  X,
  Zap,
  Clock,
  Globe,
  Shuffle,
  Link,
  Search,
  Eye,
  EyeOff,
  Download
} from "lucide-react";

// Enhanced API with crawling support
const api = {
  async getContentImages(websiteId?: string) {
    const url = websiteId 
      ? `/api/images/content-images?websiteId=${websiteId}`
      : '/api/images/content-images';
    
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Server error: ${response.status}`);
        }
        return [];
      }
      
      const data = await response.json();
      if (Array.isArray(data)) return data;
      if (data.images && Array.isArray(data.images)) return data.images;
      return [];
      
    } catch (error) {
      console.error('getContentImages error:', error);
      return [];
    }
  },

  async crawlWebsiteImages(url: string, options: any) {
    try {
      const response = await fetch('/api/images/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to crawl website");
      }
      
      return await response.json();
    } catch (error) {
      console.error('crawlWebsiteImages error:', error);
      throw error;
    }
  },

  async batchProcessMetadata(imageIds: string[], options: any, imageUrls?: Record<string, string>) {
  try {
    const response = await fetch('/api/images/batch-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds, options, imageUrls }) // Add imageUrls here
    });
      
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to process images");
        }
        throw new Error(`Processing failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('batchProcessMetadata error:', error);
      throw error;
    }
  },

  async getWebsites() {
    try {
      const response = await fetch("/api/user/websites");
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`Failed to fetch websites: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
      
    } catch (error) {
      console.error('getWebsites error:', error);
      return [];
    }
  },

  async getImageStatus(contentId: string) {
    try {
      const response = await fetch(`/api/images/batch-process?contentId=${contentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('getImageStatus error:', error);
      throw error;
    }
  }
};

// Utility functions
const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface ContentImage {
  id: string;
  url?: string;
  data?: string;
  contentId: string;
  contentTitle: string;
  websiteId: string;
  websiteName: string;
  hasMetadata: boolean;
  metadataDetails?: {
    copyright?: string;
    author?: string;
    aiModel?: string;
    aiProvider?: string;
    altText?: string;
    caption?: string;
  };
  size: number;
  createdAt: string;
  isAIGenerated: boolean;
  processedAt?: string;
  costCents?: number;
  isCrawled?: boolean;
  source?: string;
}

interface Website {
  id: string;
  name: string;
  domain?: string;
  url?: string;
  status?: string;
  contentCount?: number;
  lastContentDate?: string;
}

interface ProcessOptions {
  action: 'add' | 'strip' | 'update' | 'scramble';
  copyright?: string;
  author?: string;
  removeGPS?: boolean;
  optimize?: boolean;
  maxWidth?: number;
  quality?: number;
  keepColorProfile?: boolean;
  // EXIF metadata fields
  imageDescription?: string;
  make?: string;
  model?: string;
  software?: string;
  hostComputer?: string;
  // Scrambling options
  scrambleType?: 'pixel-shift' | 'watermark' | 'blur-regions' | 'color-shift' | 'noise';
  scrambleIntensity?: number;
  watermarkText?: string;
  watermarkPosition?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  preserveFaces?: boolean;
}

interface CrawlOptions {
  maxDepth: number;
  maxImages: number;
  followExternal: boolean;
  includeSubdomains: boolean;
  imageTypes: string[];
  minWidth?: number;
  minHeight?: number;
  excludePatterns?: string[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ProcessingStatus {
  imageId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
}

export default function EnhancedImageMetadata() {
  // State management
  const [images, setImages] = useState<ContentImage[]>([]);
  const [crawledImages, setCrawledImages] = useState<ContentImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [filter, setFilter] = useState<'all' | 'with-metadata' | 'without-metadata' | 'ai-generated' | 'crawled'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showCrawler, setShowCrawler] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus[]>([]);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [activeTab, setActiveTab] = useState<'existing' | 'crawl'>('existing');

  // Crawling state
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlOptions, setCrawlOptions] = useState<CrawlOptions>({
    maxDepth: 2,
    maxImages: 50,
    followExternal: false,
    includeSubdomains: true,
    imageTypes: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    minWidth: 200,
    minHeight: 200,
    excludePatterns: ['thumbnail', 'icon', 'logo', 'avatar']
  });
  const [crawlProgress, setCrawlProgress] = useState<{
    current: number;
    total: number;
    currentUrl: string;
  } | null>(null);

  // Processing options with scrambling
  const [processOptions, setProcessOptions] = useState<ProcessOptions>({
    action: 'add',
    copyright: `© ${new Date().getFullYear()}`,
    author: 'AI Content Generator',
    removeGPS: true,
    optimize: true,
    maxWidth: 1920,
    quality: 85,
    keepColorProfile: true,
    // EXIF metadata fields
    imageDescription: 'Property of Murray Group',
    make: 'AI Content Manager',
    model: 'Image Processor v1.0',
    software: 'AI Content Manager - Murray Group',
    hostComputer: 'Murray Group Real Estate System',
    // Scrambling defaults
    scrambleType: 'pixel-shift',
    scrambleIntensity: 50,
    watermarkText: 'CONFIDENTIAL',
    watermarkPosition: 'bottom-right',
    preserveFaces: true
  });

  // Toast management
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Load websites on mount
  useEffect(() => {
    loadWebsites();
  }, []);

  // Load images when website changes
  useEffect(() => {
    if (websites.length > 0 || selectedWebsite === "") {
      loadImages();
    }
  }, [selectedWebsite, websites]);

  const loadWebsites = async () => {
    try {
      const data = await api.getWebsites();
      
      if (Array.isArray(data)) {
        setWebsites(data);
        
        if (data.length > 0 && !selectedWebsite) {
          setSelectedWebsite(data[0].id);
        }
        
        if (data.length === 0) {
          addToast("No websites found. Please add a website first.", "info");
          setApiAvailable(false);
        } else {
          setApiAvailable(true);
        }
      } else {
        setWebsites([]);
        setApiAvailable(false);
      }
    } catch (error: any) {
      setWebsites([]);
      addToast("Website API not configured. Please set up your websites first.", "info");
      setApiAvailable(false);
    }
  };

  const loadImages = async () => {
    if (websites.length === 0 && selectedWebsite) {
      setImages([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await api.getContentImages(selectedWebsite || undefined);
      
      if (Array.isArray(data)) {
        // Combine with crawled images
        const allImages = [...data, ...crawledImages];
        setImages(allImages);
        
        if (data.length > 0) {
          const withMetadata = data.filter(img => img.hasMetadata).length;
          const withoutMetadata = data.length - withMetadata;
          
          addToast(
            `Loaded ${data.length} images (${withMetadata} protected, ${withoutMetadata} unprotected)`,
            "info"
          );
        }
      } else {
        setImages(crawledImages);
      }
    } catch (error: any) {
      setImages(crawledImages);
      addToast(error.message || "Failed to load images", "error");
    } finally {
      setIsLoading(false);
    }
  };

const handleCrawlWebsite = async (): Promise<void> => {
  if (!crawlUrl) {
    addToast("Please enter a URL to crawl", "warning");
    return;
  }

  setIsCrawling(true);
  setCrawlProgress({ current: 0, total: 0, currentUrl: crawlUrl });

  try {
    // Use actual API call
    const result = await api.crawlWebsiteImages(crawlUrl, crawlOptions);

    const crawledData = (result?.images ?? [])
      .map((img: any) => ({
        ...img,
        // Ensure each crawled image has required properties
        id:
          img.id ||
          `crawled_${(typeof crypto !== "undefined" && "randomUUID" in crypto
            ? (crypto as any).randomUUID()
            : Math.random().toString(36).slice(2, 11))}`,
        url: img.url ?? img.src ?? img.source ?? "", // Ensure URL is set
        websiteId: selectedWebsite ?? "crawled",
        websiteName: "Crawled",
        isCrawled: true,
        hasMetadata: false,
        contentTitle: img.title ?? img.alt ?? "Crawled Image",
        size: img.size ?? 0,
        createdAt: img.createdAt ?? new Date().toISOString(),
      }))
      .filter((x: any) => x.url); // drop items without a usable URL

    setCrawledImages((prev: any[]) => [...prev, ...crawledData]);
    setImages((prev: any[]) => [...prev, ...crawledData]);
  } catch (err) {
    console.error(err);
    addToast("Failed to crawl site. Please try again.", "error");
  } finally {
    setIsCrawling(false);
  }
};


  const handleSelectAll = () => {
    if (selectedImages.length === filteredImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(filteredImages.map(img => img.id));
    }
  };

  const handleSelectImage = (imageId: string) => {
    setSelectedImages(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };


const handleBatchProcess = async () => {
    if (selectedImages.length === 0) {
      addToast("Please select images to process", "warning");
      return;
    }

    // Confirm action for destructive operations
    if (processOptions.action === 'strip') {
      const confirmed = window.confirm(
        `Are you sure you want to strip metadata from ${selectedImages.length} images? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    if (processOptions.action === 'scramble') {
      const confirmed = window.confirm(
        `Are you sure you want to scramble ${selectedImages.length} images? This will modify the image content.`
      );
      if (!confirmed) return;
    }

    setIsProcessing(true);
    
    const initialStatus: ProcessingStatus[] = selectedImages.map(id => ({
      imageId: id,
      status: 'pending'
    }));
    setProcessingStatus(initialStatus);

    try {
      setProcessingStatus(prev => 
        prev.map(s => ({ ...s, status: 'processing' as const }))
      );

      // Build URL mapping for crawled images
      const imageUrls: Record<string, string> = {};
      console.log('Building URL mapping for selected images:', selectedImages);
      console.log('All images in state:', images);
      
      for (const imageId of selectedImages) {
        const image = images.find(img => img.id === imageId);
        console.log(`Looking for image with ID ${imageId}:`, image);
        
        if (image) {
          console.log(`  Image found - isCrawled: ${image.isCrawled}, URL: ${image.url}`);
          
          if (image.isCrawled || imageId.startsWith('crawled')) {
            // For crawled images, we need to provide the URL
            const url = image.url || image.data || '';
            if (url) {
              imageUrls[imageId] = url;
              console.log(`  ✅ Added URL mapping: ${imageId} -> ${url.substring(0, 50)}...`);
            } else {
              console.warn(`  ⚠️ No URL found for crawled image ${imageId}`);
            }
          }
        } else {
          console.error(`  ❌ Image not found in state for ID: ${imageId}`);
        }
      }
      
      console.log('Final imageUrls mapping:', imageUrls);
      console.log('Number of URLs mapped:', Object.keys(imageUrls).length);

      const result = await api.batchProcessMetadata(selectedImages, processOptions, imageUrls);
      
      if (result.results) {
        setProcessingStatus(prev => 
          prev.map(s => ({
            ...s,
            status: result.results.success.some((success: any) => success.imageId === s.imageId) 
              ? 'success' as const
              : 'failed' as const
          }))
        );
      }

      const actionText = 
        processOptions.action === 'add' ? 'Added metadata to' : 
        processOptions.action === 'strip' ? 'Stripped metadata from' : 
        processOptions.action === 'scramble' ? 'Scrambled' :
        'Updated metadata for';

      addToast(
        `${actionText} ${result.processed} of ${result.total} images (${result.successRate})`,
        result.failed > 0 ? "warning" : "success"
      );

      if (result.errors && result.errors.length > 0) {
        console.error('Processing errors:', result.errors);
        if (result.errors[0]) {
          addToast(`Error: ${result.errors[0].message}`, "error");
        }
      }
      
      await loadImages();
      setSelectedImages([]);
      
      setTimeout(() => {
        setProcessingStatus([]);
      }, 3000);
      
    } catch (error: any) {
      console.error('Batch processing error:', error);
      addToast(error.message || "Failed to process images", "error");
      
      setProcessingStatus(prev => 
        prev.map(s => ({ ...s, status: 'failed' as const, error: 'Processing failed' }))
      );
      
      setTimeout(() => {
        setProcessingStatus([]);
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleDownloadCrawled = () => {
    const crawledData = crawledImages.map(img => ({
      url: img.url,
      title: img.contentTitle,
      source: img.source,
      size: img.size
    }));
    
    const blob = new Blob([JSON.stringify(crawledData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crawled-images-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addToast(`Downloaded ${crawledImages.length} crawled image URLs`, "success");
  };

  // Filter images based on selected filter
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      if (selectedWebsite && img.websiteId !== selectedWebsite && img.websiteId !== 'crawled') {
        return false;
      }
      
      switch (filter) {
        case 'with-metadata':
          return img.hasMetadata;
        case 'without-metadata':
          return !img.hasMetadata;
        case 'ai-generated':
          return img.isAIGenerated;
        case 'crawled':
          return img.isCrawled === true;
        default:
          return true;
      }
    });
  }, [images, filter, selectedWebsite]);

  // Calculate statistics
  const stats = useMemo(() => ({
    total: images.length,
    withMetadata: images.filter(img => img.hasMetadata).length,
    withoutMetadata: images.filter(img => !img.hasMetadata).length,
    aiGenerated: images.filter(img => img.isAIGenerated).length,
    crawled: images.filter(img => img.isCrawled).length,
    totalSize: images.reduce((sum, img) => sum + (img.size || 0), 0),
    totalCost: images.reduce((sum, img) => sum + (img.costCents || 0), 0)
  }), [images]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              flex items-center justify-between p-4 rounded-lg shadow-lg min-w-[300px]
              ${toast.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                toast.type === 'warning' ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
                toast.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                'bg-green-50 text-green-800 border border-green-200'}
            `}
          >
            <div className="flex items-center">
              {toast.type === 'error' || toast.type === 'warning' ? 
                <AlertTriangle className="w-5 h-5 mr-2" /> :
               toast.type === 'info' ? 
                <Info className="w-5 h-5 mr-2" /> :
                <CheckCircle className="w-5 h-5 mr-2" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Enhanced Image Metadata Manager
          </h1>
          <p className="text-gray-600">
            Crawl, process, strip, and scramble image metadata
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-gray-500">{formatFileSize(stats.totalSize)}</p>
              </div>
              <FileImage className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Protected</p>
                <p className="text-2xl font-bold text-green-600">{stats.withMetadata}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? `${Math.round((stats.withMetadata / stats.total) * 100)}%` : '0%'}
                </p>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unprotected</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.withoutMetadata}</p>
                <p className="text-xs text-gray-500">
                  {stats.total > 0 ? `${Math.round((stats.withoutMetadata / stats.total) * 100)}%` : '0%'}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Generated</p>
                <p className="text-2xl font-bold text-purple-600">{stats.aiGenerated}</p>
                <p className="text-xs text-gray-500">
                  ${(stats.totalCost / 100).toFixed(2)}
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Crawled</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.crawled}</p>
                <p className="text-xs text-gray-500">External</p>
              </div>
              <Globe className="w-8 h-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Selected</p>
                <p className="text-2xl font-bold text-orange-600">{selectedImages.length}</p>
                <p className="text-xs text-gray-500">Ready</p>
              </div>
              <CheckCircle className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-t-lg shadow-sm border border-b-0 border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('existing')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'existing' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileImage className="w-4 h-4 inline mr-2" />
              Existing Images
            </button>
            <button
              onClick={() => {
                setActiveTab('crawl');
                // Immediately set the URL when switching to crawl tab
                if (selectedWebsite && websites.length > 0) {
                  const website = websites.find(w => w.id === selectedWebsite);
                  if (website?.url && !crawlUrl) {
                    setCrawlUrl(website.url);
                  }
                }
              }}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'crawl' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-2" />
              Web Crawler
            </button>
          </div>
        </div>

        {/* Crawler Panel */}
        {activeTab === 'crawl' && (
          <div className="bg-white shadow-sm border border-t-0 border-gray-200 mb-6">
            <div className="p-6">
              <h3 className="text-lg font-medium mb-4">Web Image Crawler</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={crawlUrl}
                      onChange={(e) => setCrawlUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={isCrawling}
                    />
                    <button
                      onClick={handleCrawlWebsite}
                      disabled={isCrawling || !crawlUrl}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isCrawling ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Crawling...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Start Crawl
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {crawlProgress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">
                        Crawling: {crawlProgress.current} / {crawlProgress.total} images
                      </span>
                      <span className="text-xs text-blue-700">
                        {Math.round((crawlProgress.current / crawlProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(crawlProgress.current / crawlProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-700 mt-2 truncate">
                      Current: {crawlProgress.currentUrl}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Depth
                    </label>
                    <input
                      type="number"
                      value={crawlOptions.maxDepth}
                      onChange={(e) => setCrawlOptions({...crawlOptions, maxDepth: parseInt(e.target.value)})}
                      min="1"
                      max="5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isCrawling}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Images
                    </label>
                    <input
                      type="number"
                      value={crawlOptions.maxImages}
                      onChange={(e) => setCrawlOptions({...crawlOptions, maxImages: parseInt(e.target.value)})}
                      min="1"
                      max="500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isCrawling}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Width (px)
                    </label>
                    <input
                      type="number"
                      value={crawlOptions.minWidth}
                      onChange={(e) => setCrawlOptions({...crawlOptions, minWidth: parseInt(e.target.value)})}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isCrawling}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={crawlOptions.followExternal}
                      onChange={(e) => setCrawlOptions({...crawlOptions, followExternal: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                      disabled={isCrawling}
                    />
                    <span className="text-sm">Follow external links</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={crawlOptions.includeSubdomains}
                      onChange={(e) => setCrawlOptions({...crawlOptions, includeSubdomains: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                      disabled={isCrawling}
                    />
                    <span className="text-sm">Include subdomains</span>
                  </label>
                </div>

                {crawledImages.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-sm text-gray-600">
                      {crawledImages.length} images crawled in this session
                    </span>
                    <button
                      onClick={handleDownloadCrawled}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export URLs
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full px-6 py-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center">
              <Settings className="w-5 h-5 mr-2 text-gray-600" />
              <span className="font-medium">Processing Settings</span>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showSettings && (
            <div className="px-6 pb-6 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <select
                    value={processOptions.action}
                    onChange={(e) => setProcessOptions({...processOptions, action: e.target.value as ProcessOptions['action']})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="add">Add Metadata</option>
                    <option value="strip">Strip All Metadata</option>
                    <option value="update">Update Existing Metadata</option>
                    <option value="scramble">Scramble Image</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {processOptions.action === 'add' && 'Add copyright and author information'}
                    {processOptions.action === 'strip' && 'Remove all metadata from images'}
                    {processOptions.action === 'update' && 'Update existing metadata fields'}
                    {processOptions.action === 'scramble' && 'Obfuscate image content for privacy'}
                  </p>
                </div>

                {processOptions.action === 'scramble' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Scramble Type
                      </label>
                      <select
                        value={processOptions.scrambleType}
                        onChange={(e) => setProcessOptions({...processOptions, scrambleType: e.target.value as ProcessOptions['scrambleType']})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="pixel-shift">Pixel Shift</option>
                        <option value="watermark">Watermark Overlay</option>
                        <option value="blur-regions">Blur Regions</option>
                        <option value="color-shift">Color Distortion</option>
                        <option value="noise">Add Noise</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Intensity (1-100)
                      </label>
                      <input
                        type="number"
                        value={processOptions.scrambleIntensity}
                        onChange={(e) => setProcessOptions({...processOptions, scrambleIntensity: parseInt(e.target.value)})}
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    {processOptions.scrambleType === 'watermark' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Watermark Text
                          </label>
                          <input
                            type="text"
                            value={processOptions.watermarkText}
                            onChange={(e) => setProcessOptions({...processOptions, watermarkText: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Position
                          </label>
                          <select
                            value={processOptions.watermarkPosition}
                            onChange={(e) => setProcessOptions({...processOptions, watermarkPosition: e.target.value as ProcessOptions['watermarkPosition']})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="center">Center</option>
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Privacy Options
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={processOptions.preserveFaces}
                          onChange={(e) => setProcessOptions({...processOptions, preserveFaces: e.target.checked})}
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="text-sm">Detect and blur faces</span>
                      </label>
                    </div>
                  </>
                ) : processOptions.action !== 'strip' && (
                  <>
                    <div className="col-span-full">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-start">
                          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-blue-900 font-medium mb-1">EXIF Metadata Fields</p>
                            <p className="text-xs text-blue-700">
                              These fields will be embedded in the image file's EXIF data. This information can be viewed in image editing software and helps establish ownership and origin of the images.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Copyright
                      </label>
                      <input
                        type="text"
                        value={processOptions.copyright}
                        onChange={(e) => setProcessOptions({...processOptions, copyright: e.target.value})}
                        placeholder="© 2024 Your Company"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Author/Artist
                      </label>
                      <input
                        type="text"
                        value={processOptions.author}
                        onChange={(e) => setProcessOptions({...processOptions, author: e.target.value})}
                        placeholder="AI Content Generator"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image Description
                      </label>
                      <input
                        type="text"
                        value={processOptions.imageDescription}
                        onChange={(e) => setProcessOptions({...processOptions, imageDescription: e.target.value})}
                        placeholder="Property description"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Camera Make
                      </label>
                      <input
                        type="text"
                        value={processOptions.make}
                        onChange={(e) => setProcessOptions({...processOptions, make: e.target.value})}
                        placeholder="AI Content Manager"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Camera Model
                      </label>
                      <input
                        type="text"
                        value={processOptions.model}
                        onChange={(e) => setProcessOptions({...processOptions, model: e.target.value})}
                        placeholder="Image Processor v1.0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Software
                      </label>
                      <input
                        type="text"
                        value={processOptions.software}
                        onChange={(e) => setProcessOptions({...processOptions, software: e.target.value})}
                        placeholder="AI Content Manager - Murray Group"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Host Computer
                      </label>
                      <input
                        type="text"
                        value={processOptions.hostComputer}
                        onChange={(e) => setProcessOptions({...processOptions, hostComputer: e.target.value})}
                        placeholder="Murray Group Real Estate System"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Optimization
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={processOptions.removeGPS}
                        onChange={(e) => setProcessOptions({...processOptions, removeGPS: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 mr-2"
                      />
                      <span className="text-sm">Remove GPS Data</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={processOptions.optimize}
                        onChange={(e) => setProcessOptions({...processOptions, optimize: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 mr-2"
                      />
                      <span className="text-sm">Optimize for Web</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={processOptions.keepColorProfile}
                        onChange={(e) => setProcessOptions({...processOptions, keepColorProfile: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 mr-2"
                      />
                      <span className="text-sm">Keep Color Profile</span>
                    </label>
                  </div>
                </div>

                {processOptions.optimize && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Width (px)
                      </label>
                      <input
                        type="number"
                        value={processOptions.maxWidth}
                        onChange={(e) => setProcessOptions({...processOptions, maxWidth: parseInt(e.target.value)})}
                        min="640"
                        max="3840"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quality (1-100)
                      </label>
                      <input
                        type="number"
                        value={processOptions.quality}
                        onChange={(e) => setProcessOptions({...processOptions, quality: parseInt(e.target.value)})}
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedWebsite}
                  onChange={(e) => setSelectedWebsite(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  disabled={websites.length === 0}
                >
                  {websites.length > 0 ? (
                    <>
                      <option value="">All Sources</option>
                      {websites.map(site => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                          {site.contentCount ? ` (${site.contentCount} items)` : ''}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="">No websites available</option>
                  )}
                </select>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as typeof filter)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Images ({stats.total})</option>
                    <option value="with-metadata">With Metadata ({stats.withMetadata})</option>
                    <option value="without-metadata">Without Metadata ({stats.withoutMetadata})</option>
                    <option value="ai-generated">AI Generated ({stats.aiGenerated})</option>
                    <option value="crawled">Crawled ({stats.crawled})</option>
                  </select>
                </div>

                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedImages.length === filteredImages.length && filteredImages.length > 0 
                    ? 'Deselect All' 
                    : 'Select All'}
                </button>

                {selectedImages.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedImages.length} of {filteredImages.length} selected
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={loadImages}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleBatchProcess}
                  disabled={selectedImages.length === 0 || isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing {processingStatus.filter(s => s.status === 'processing').length} images...
                    </>
                  ) : processOptions.action === 'scramble' ? (
                    <>
                      <Shuffle className="w-4 h-4 mr-2" />
                      Scramble Selected ({selectedImages.length})
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Process Selected ({selectedImages.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Image Grid */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-600">Loading images from database...</p>
              </div>
            ) : filteredImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredImages.map(image => {
                  const processingItem = processingStatus.find(s => s.imageId === image.id);
                  const isSelected = selectedImages.includes(image.id);
                  
                  return (
                    <div
                      key={image.id}
                      className={`
                        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                        ${isSelected ? 'border-blue-500 shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-gray-300'}
                        ${processingItem?.status === 'processing' ? 'animate-pulse' : ''}
                        ${processingItem?.status === 'success' ? 'ring-2 ring-green-500' : ''}
                        ${processingItem?.status === 'failed' ? 'ring-2 ring-red-500' : ''}
                      `}
                      onClick={() => handleSelectImage(image.id)}
                    >
                      <div className="aspect-square bg-gray-100">
                        {image.data ? (
                          <img
                            src={image.data}
                            alt={image.contentTitle}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : image.url ? (
                          <img
                            src={image.url}
                            alt={image.contentTitle}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                          <p className="text-xs font-medium truncate">{image.contentTitle}</p>
                          <p className="text-xs opacity-90">{formatFileSize(image.size)}</p>
                          <p className="text-xs opacity-80">{image.websiteName}</p>
                        </div>
                      </div>

                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {image.hasMetadata && (
                          <span className="bg-green-500 text-white p-1 rounded" title="Has metadata">
                            <Shield className="w-3 h-3" />
                          </span>
                        )}
                        {image.isAIGenerated && (
                          <span className="bg-purple-500 text-white text-[10px] px-1 py-0.5 rounded font-bold">
                            AI
                          </span>
                        )}
                        {image.isCrawled && (
                          <span className="bg-indigo-500 text-white p-1 rounded" title="Crawled">
                            <Globe className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="absolute top-2 left-2">
                        <div className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                          ${isSelected 
                            ? 'bg-blue-500 border-blue-500 scale-110' 
                            : 'bg-white/80 border-gray-300 group-hover:border-gray-400'}
                        `}>
                          {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </div>

                      {processingItem && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          {processingItem.status === 'processing' && (
                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                          )}
                          {processingItem.status === 'success' && (
                            <CheckCircle className="w-8 h-8 text-green-400" />
                          )}
                          {processingItem.status === 'failed' && (
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Image className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
                <p className="text-sm text-gray-500 text-center max-w-md">
                  {activeTab === 'crawl' 
                    ? 'Start crawling a website to discover images'
                    : !apiAvailable 
                      ? 'API endpoints are not configured. Please set up your backend services first.' 
                      : websites.length === 0 
                        ? 'No websites found. Please generate content with images first using the AI Content page.' 
                        : selectedWebsite 
                          ? 'No images found for this website. Generate content with images enabled or try crawling.'
                          : 'Select a website to view images or start crawling to discover new ones.'}
                </p>
                {filter !== 'all' && (
                  <button
                    onClick={() => setFilter('all')}
                    className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear filter
                  </button>
                )}
                {activeTab === 'existing' && (
                  <button
                    onClick={() => setActiveTab('crawl')}
                    className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Start Crawling Images
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
