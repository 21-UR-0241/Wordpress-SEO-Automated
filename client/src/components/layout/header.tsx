// import { useState } from "react";
// import { Search, Plus, Menu } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
// import AddWebsiteForm from "@/components/forms/add-website-form";
// import { useMobileSidebar } from "./sidebar";
// import { useIsMobile } from "@/hooks/use-mobile";

// // ⬇️ Import the simple, real-data bell
// import ActivityBellSimple from "@/components/notifications/activity-bell-simple";

// export default function Header() {
//   const [isAddWebsiteOpen, setIsAddWebsiteOpen] = useState(false);
//   const { setIsOpen } = useMobileSidebar();
//   const isMobile = useIsMobile();

//   return (
//     <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200">
//       {isMobile && (
//         <button
//           onClick={() => setIsOpen(true)}
//           className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
//         >
//           <Menu className="w-5 h-5" />
//         </button>
//       )}

//       <div className="flex-1 px-4 flex justify-between items-center">
//         <div className="flex-1 flex">
//           <div className="w-full flex md:ml-0">
//             <span className="sr-only">Search</span>
//             <div className="relative w-full text-gray-400 focus-within:text-gray-600 max-w-lg">
//               <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
//                 <Search className="w-5 h-5" />
//               </div>
      
//             </div>
//           </div>
//         </div>

//         <div className="ml-2 sm:ml-4 flex items-center md:ml-6 space-x-2 sm:space-x-4">
//           <ActivityBellSimple />

//           {/* Add Website Dialog */}
//           <Dialog open={isAddWebsiteOpen} onOpenChange={setIsAddWebsiteOpen}>
//             <DialogTrigger asChild>
//               <Button className="bg-primary-500 hover:bg-primary-600 text-white px-2 sm:px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 sm:space-x-2">
//                 <Plus className="w-4 h-4" />
//                 {!isMobile && <span>Add Website</span>}
//               </Button>
//             </DialogTrigger>
//             <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
//               <AddWebsiteForm onSuccess={() => setIsAddWebsiteOpen(false)} />
//             </DialogContent>
//           </Dialog>
//         </div>
//       </div>
//     </div>
//   );
// }














// client/src/components/layout/header.tsx
// client/src/components/layout/header.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Menu, X, FileText, Globe, BarChart3, Calendar, Clock, Eye, Copy, ExternalLink, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import AddWebsiteForm from "@/components/forms/add-website-form";
import { useMobileSidebar } from "./sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { debounce } from "lodash";

// Import the simple, real-data bell
import ActivityBellSimple from "@/components/notifications/activity-bell-simple";

// Types for search results with extended details
type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  type: 'website' | 'report' | 'post';
  url?: string;
  icon: React.ReactNode;
  path: string;
  // Extended details
  details?: {
    status?: string;
    period?: string;
    reportType?: string;
    keywords?: string[];
    content?: string;
    websiteName?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    category?: string;
    publishedAt?: string;
    views?: number;
    likes?: number;
    domain?: string;
    description?: string;
    generatedAt?: string;
    metrics?: any;
    websiteId?: string;
    [key: string]: any;
  };
  rawData?: any; // Store the complete raw data
};

type ActivityLog = {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
};

export default function Header() {
  const [isAddWebsiteOpen, setIsAddWebsiteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  const { setIsOpen } = useMobileSidebar();
  const isMobile = useIsMobile();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch data for searching
const { data: websites } = useQuery({
  queryKey: ["/api/user/websites"],
  queryFn: () => api.getWebsites(), // Add arrow function wrapper for consistency
  staleTime: 5 * 60 * 1000,
});

const { data: reports } = useQuery({
  queryKey: ["/api/user/reports"],
  queryFn: () => api.getClientReports(), // Fixed: arrow function wrapper
  staleTime: 5 * 60 * 1000,
});

const { data: posts } = useQuery({
  queryKey: ["/api/user/posts"],
  queryFn: async () => {  // Fixed: inline function since getPosts doesn't exist
    const response = await fetch("/api/user/posts");
    if (!response.ok) throw new Error("Failed to fetch posts");
    return response.json();
  },
  staleTime: 5 * 60 * 1000,
});
  // Get entity ID for activity logs
  const getEntityId = () => {
    if (!selectedResult) return undefined;
    if (selectedResult.type === 'website') {
      return selectedResult.id;
    }
    // For reports and posts, use the associated website ID
    return selectedResult.details?.websiteId || selectedResult.id;
  };

  const { data: activityLogs } = useQuery({
    queryKey: ["/api/user/activity-logs", getEntityId()],
    queryFn: () => api.getActivityLogs(getEntityId()),
    enabled: !!selectedResult && isDetailsOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Debounced search function
  const performSearch = useCallback(
    debounce((query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const results: SearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      // Search websites with all details
      if (websites) {
        const websiteResults = websites
          .filter(site => 
            site.name?.toLowerCase().includes(lowerQuery) ||
            site.url?.toLowerCase().includes(lowerQuery) ||
            site.domain?.toLowerCase().includes(lowerQuery) ||
            site.description?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 3)
          .map(site => ({
            id: site.id,
            title: site.name,
            subtitle: site.url,
            type: 'website' as const,
            url: site.url, // Store the actual website URL
            icon: <Globe className="w-4 h-4" />,
            path: `/websites/${site.id}`,
            details: {
              url: site.url,
              domain: site.domain,
              description: site.description,
              status: site.status,
              createdAt: site.createdAt,
              updatedAt: site.updatedAt,
              ...site
            },
            rawData: site
          }));
        results.push(...websiteResults);
      }

      // Search reports with all details
      if (reports) {
        const reportResults = reports
          .filter(report => 
            report.websiteName?.toLowerCase().includes(lowerQuery) ||
            report.reportType?.toLowerCase().includes(lowerQuery) ||
            report.period?.toLowerCase().includes(lowerQuery) ||
            report.status?.toLowerCase().includes(lowerQuery) ||
            report.description?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 3)
          .map(report => ({
            id: report.id,
            title: `${report.reportType?.charAt(0).toUpperCase()}${report.reportType?.slice(1)} Report`,
            subtitle: report.websiteName,
            type: 'report' as const,
            icon: <BarChart3 className="w-4 h-4" />,
            path: `/reports/${report.id}`,
            details: {
              websiteId: report.websiteId,
              websiteName: report.websiteName,
              reportType: report.reportType,
              period: report.period,
              status: report.status,
              generatedAt: report.generatedAt,
              createdAt: report.createdAt,
              metrics: report.metrics,
              ...report
            },
            rawData: report
          }));
        results.push(...reportResults);
      }

      // Search posts with all details
      if (posts) {
        const postResults = posts
          .filter(post => 
            post.title?.toLowerCase().includes(lowerQuery) ||
            post.content?.toLowerCase().includes(lowerQuery) ||
            post.keywords?.some(k => k.toLowerCase().includes(lowerQuery)) ||
            post.author?.toLowerCase().includes(lowerQuery) ||
            post.category?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 3)
          .map(post => ({
            id: post.id,
            title: post.title,
            subtitle: post.websiteName,
            type: 'post' as const,
            icon: <FileText className="w-4 h-4" />,
            path: `/posts/${post.id}`,
            details: {
              websiteId: post.websiteId,
              status: post.status,
              websiteName: post.websiteName,
              keywords: post.keywords,
              content: post.content,
              author: post.author,
              category: post.category,
              publishedAt: post.publishedAt,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              views: post.views,
              likes: post.likes,
              ...post
            },
            rawData: post
          }));
        results.push(...postResults);
      }

      setSearchResults(results);
      setIsSearching(false);
    }, 300),
    [websites, reports, posts]
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedIndex(-1);
    
    if (query.trim()) {
      setShowResults(true);
      performSearch(query);
    } else {
      setShowResults(false);
      setSearchResults([]);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleResultClick(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle clicking on a search result - now opens details modal
  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result);
    setIsDetailsOpen(true);
    setShowResults(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedIndex(-1);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'website':
        return 'bg-blue-100 text-blue-700';
      case 'report':
        return 'bg-green-100 text-green-700';
      case 'post':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'published':
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'draft':
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'inactive':
      case 'error':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Get activity type icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'content_generated':
        return <FileText className="w-4 h-4" />;
      case 'seo_analysis':
        return <TrendingUp className="w-4 h-4" />;
      case 'issue_detected':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  // Format date for display
  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  // Render detail form based on type
  const renderDetailForm = () => {
    if (!selectedResult) return null;

    const { type, details } = selectedResult;

    switch (type) {
      case 'website':
        return (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Website Name</Label>
                  <Input id="name" value={selectedResult.title} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="url">URL</Label>
                  <div className="flex gap-2">
                    <Input id="url" value={details?.url || ''} readOnly />
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => copyToClipboard(details?.url || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => window.open(details?.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" value={details?.domain || ''} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={details?.description || ''} 
                    readOnly 
                    rows={4}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Badge className={cn("w-fit", getStatusBadgeColor(details?.status))}>
                    {details?.status || 'Unknown'}
                  </Badge>
                </div>

                <div className="grid gap-2">
                  <Label>Created At</Label>
                  <Input value={formatDate(details?.createdAt)} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label>Updated At</Label>
                  <Input value={formatDate(details?.updatedAt)} readOnly />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-4">
              <ScrollArea className="h-[500px] w-full">
                {activityLogs && activityLogs.length > 0 ? (
                  <div className="space-y-2">
                    {activityLogs.map((log: ActivityLog) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(log.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 mt-1">
                            {log.description}
                          </p>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 text-xs text-gray-600">
                              {Object.entries(log.metadata).slice(0, 3).map(([key, value]) => (
                                <span key={key} className="inline-block mr-3">
                                  <span className="font-medium">{key}:</span> {String(value)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No activity logs available</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        );

      case 'report':
        return (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Report Type</Label>
                  <Input value={details?.reportType || ''} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label>Website</Label>
                  <Input value={details?.websiteName || ''} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label>Period</Label>
                  <Input value={details?.period || ''} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Badge className={cn("w-fit", getStatusBadgeColor(details?.status))}>
                    {details?.status || 'Unknown'}
                  </Badge>
                </div>
                
                <div className="grid gap-2">
                  <Label>Generated At</Label>
                  <Input value={formatDate(details?.generatedAt)} readOnly />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="metrics" className="space-y-4">
              {details?.metrics ? (
                <div className="grid gap-4">
                  {Object.entries(details.metrics).map(([key, value]) => (
                    <div key={key} className="grid gap-2">
                      <Label>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</Label>
                      <Input value={String(value)} readOnly />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No metrics available</p>
              )}
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-4">
              <ScrollArea className="h-[500px] w-full">
                {activityLogs && activityLogs.length > 0 ? (
                  <div className="space-y-2">
                    {activityLogs.map((log: ActivityLog) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(log.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 mt-1">
                            {log.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No activity logs available</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        );

      case 'post':
        return (
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={selectedResult.title} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" value={details?.websiteName || ''} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea 
                    id="content" 
                    value={details?.content || ''} 
                    readOnly 
                    rows={10}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Keywords</Label>
                  <div className="flex flex-wrap gap-2">
                    {details?.keywords?.map((keyword, i) => (
                      <Badge key={i} variant="secondary">
                        {keyword}
                      </Badge>
                    )) || <span className="text-gray-500">No keywords</span>}
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Views</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{details?.views || 0}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Likes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{details?.likes || 0}</div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Badge className={cn("w-fit", getStatusBadgeColor(details?.status))}>
                    {details?.status || 'Unknown'}
                  </Badge>
                </div>
                
                <div className="grid gap-2">
                  <Label>Author</Label>
                  <Input value={details?.author || 'N/A'} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Input value={details?.category || 'N/A'} readOnly />
                </div>
                
                <div className="grid gap-2">
                  <Label>Published At</Label>
                  <Input value={formatDate(details?.publishedAt)} readOnly />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-4">
              <ScrollArea className="h-[500px] w-full">
                {activityLogs && activityLogs.length > 0 ? (
                  <div className="space-y-2">
                    {activityLogs.map((log: ActivityLog) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(log.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.type.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 mt-1">
                            {log.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No activity logs available</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        );

      default:
        return null;
    }
  };

  // Get the actual website URL for the button
  const getWebsiteUrl = () => {
    if (!selectedResult) return null;
    
    // For websites, use the URL directly
    if (selectedResult.type === 'website') {
      return selectedResult.details?.url || selectedResult.url;
    }
    
    // For reports and posts, try to find the associated website URL
    if (selectedResult.details?.websiteId && websites) {
      const website = websites.find(w => w.id === selectedResult.details?.websiteId);
      return website?.url;
    }
    
    return null;
  };

  return (
    <>
      <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200">
        {isMobile && (
          <button
            onClick={() => setIsOpen(true)}
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 px-4 flex justify-between items-center">
          <div className="flex-1 flex">
            <div className="w-full flex md:ml-0">
              <div className="relative w-full max-w-lg" ref={searchRef}>
                {/* Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className={cn(
                      "w-5 h-5 transition-colors",
                      searchQuery ? "text-gray-600" : "text-gray-400"
                    )} />
                  </div>
                  <Input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => searchQuery && setShowResults(true)}
                    placeholder="Search websites, reports, posts..."
                    className="w-full pl-10 pr-10 py-2 border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && (
                  <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    {isSearching ? (
                      <div className="p-4 text-center text-gray-500">
                        <div className="inline-flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mr-2"></div>
                          Searching...
                        </div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="max-h-96 overflow-y-auto">
                        {searchResults.map((result, index) => (
                          <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleResultClick(result)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={cn(
                              "w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors text-left",
                              selectedIndex === index && "bg-gray-50"
                            )}
                          >
                            <div className="flex-shrink-0 text-gray-400">
                              {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {result.title}
                                </p>
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                  getTypeBadgeColor(result.type)
                                )}>
                                  {result.type}
                                </span>
                              </div>
                              {result.subtitle && (
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {result.subtitle}
                                </p>
                              )}
                            </div>
                            <Eye className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : searchQuery.trim() ? (
                      <div className="p-8 text-center">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">
                          No results found for "{searchQuery}"
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Try searching with different keywords
                        </p>
                      </div>
                    ) : null}

                    {/* Quick Actions */}
                    {searchResults.length > 0 && (
                      <div className="border-t border-gray-200 p-2 bg-gray-50">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-xs text-gray-500">
                            Click to view details
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="ml-2 sm:ml-4 flex items-center md:ml-6 space-x-2 sm:space-x-4">
            <ActivityBellSimple />

            {/* Add Website Dialog */}
            <Dialog open={isAddWebsiteOpen} onOpenChange={setIsAddWebsiteOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary-500 hover:bg-primary-600 text-white px-2 sm:px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 sm:space-x-2">
                  <Plus className="w-4 h-4" />
                  {!isMobile && <span>Add Website</span>}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
                <AddWebsiteForm onSuccess={() => setIsAddWebsiteOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedResult?.icon}
              {selectedResult?.title}
              <Badge className={cn("ml-2", selectedResult && getTypeBadgeColor(selectedResult.type))}>
                {selectedResult?.type}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              View and manage all details for this {selectedResult?.type}
            </DialogDescription>
          </DialogHeader>
          
          <Separator className="my-4" />
          
          <div className="mt-4">
            {renderDetailForm()}
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
            {getWebsiteUrl() && (
              <Button 
                onClick={() => {
                  const url = getWebsiteUrl();
                  if (url) {
                    window.open(url, '_blank');
                  }
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Go to Website
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


















// WAG ALISIN
// client/src/components/layout/header.tsx
// import { useState, useEffect, useRef, useCallback } from "react";
// import { Search, Plus, Menu, X, FileText, Globe, BarChart3, ArrowRight } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import AddWebsiteForm from "@/components/forms/add-website-form";
// import { useMobileSidebar } from "./sidebar";
// import { useIsMobile } from "@/hooks/use-mobile";
// import { useQuery } from "@tanstack/react-query";
// import { api } from "@/lib/api";
// import { useNavigate } from "react-router-dom";
// import { cn } from "@/lib/utils";
// import { debounce } from "lodash";

// // Import the simple, real-data bell
// import ActivityBellSimple from "@/components/notifications/activity-bell-simple";

// // Types for search results
// type SearchResult = {
//   id: string;
//   title: string;
//   subtitle?: string;
//   type: 'website' | 'report' | 'post';
//   url?: string;
//   icon: React.ReactNode;
//   path: string;
// };

// export default function Header() {
//   const [isAddWebsiteOpen, setIsAddWebsiteOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
//   const [isSearching, setIsSearching] = useState(false);
//   const [showResults, setShowResults] = useState(false);
//   const [selectedIndex, setSelectedIndex] = useState(-1);
  
//   const { setIsOpen } = useMobileSidebar();
//   const isMobile = useIsMobile();
//   const searchRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLInputElement>(null);

//   // Navigation function without react-router-dom
//   const navigate = (path: string) => {
//     window.location.href = path;
//   };

//   // Fetch data for searching
//   const { data: websites } = useQuery({
//     queryKey: ["/api/user/websites"],
//     queryFn: api.getWebsites,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { data: reports } = useQuery({
//     queryKey: ["/api/user/reports"],
//     queryFn: api.getClientReports,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { data: posts } = useQuery({
//     queryKey: ["/api/user/posts"],
//     queryFn: api.getPosts,
//     staleTime: 5 * 60 * 1000,
//   });

//   // Debounced search function
//   const performSearch = useCallback(
//     debounce((query: string) => {
//       if (!query.trim()) {
//         setSearchResults([]);
//         setIsSearching(false);
//         return;
//       }

//       setIsSearching(true);
//       const results: SearchResult[] = [];
//       const lowerQuery = query.toLowerCase();

//       // Search websites
//       if (websites) {
//         const websiteResults = websites
//           .filter(site => 
//             site.name.toLowerCase().includes(lowerQuery) ||
//             site.url.toLowerCase().includes(lowerQuery)
//           )
//           .slice(0, 3)
//           .map(site => ({
//             id: site.id,
//             title: site.name,
//             subtitle: site.url,
//             type: 'website' as const,
//             icon: <Globe className="w-4 h-4" />,
//             path: `/websites/${site.id}`
//           }));
//         results.push(...websiteResults);
//       }

//       // Search reports
//       if (reports) {
//         const reportResults = reports
//           .filter(report => 
//             report.websiteName?.toLowerCase().includes(lowerQuery) ||
//             report.reportType?.toLowerCase().includes(lowerQuery) ||
//             report.period?.toLowerCase().includes(lowerQuery)
//           )
//           .slice(0, 3)
//           .map(report => ({
//             id: report.id,
//             title: `${report.reportType?.charAt(0).toUpperCase()}${report.reportType?.slice(1)} Report - ${report.websiteName}`,
//             subtitle: report.period,
//             type: 'report' as const,
//             icon: <BarChart3 className="w-4 h-4" />,
//             path: `/reports?id=${report.id}`
//           }));
//         results.push(...reportResults);
//       }

//       // Search posts
//       if (posts) {
//         const postResults = posts
//           .filter(post => 
//             post.title?.toLowerCase().includes(lowerQuery) ||
//             post.content?.toLowerCase().includes(lowerQuery) ||
//             post.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
//           )
//           .slice(0, 3)
//           .map(post => ({
//             id: post.id,
//             title: post.title,
//             subtitle: `${post.status} • ${post.websiteName}`,
//             type: 'post' as const,
//             icon: <FileText className="w-4 h-4" />,
//             path: `/posts/${post.id}`
//           }));
//         results.push(...postResults);
//       }

//       setSearchResults(results);
//       setIsSearching(false);
//     }, 300),
//     [websites, reports, posts]
//   );

//   // Handle search input change
//   const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const query = e.target.value;
//     setSearchQuery(query);
//     setSelectedIndex(-1);
    
//     if (query.trim()) {
//       setShowResults(true);
//       performSearch(query);
//     } else {
//       setShowResults(false);
//       setSearchResults([]);
//     }
//   };

//   // Handle keyboard navigation
//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (!showResults || searchResults.length === 0) return;

//     switch (e.key) {
//       case 'ArrowDown':
//         e.preventDefault();
//         setSelectedIndex(prev => 
//           prev < searchResults.length - 1 ? prev + 1 : 0
//         );
//         break;
//       case 'ArrowUp':
//         e.preventDefault();
//         setSelectedIndex(prev => 
//           prev > 0 ? prev - 1 : searchResults.length - 1
//         );
//         break;
//       case 'Enter':
//         e.preventDefault();
//         if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
//           handleResultClick(searchResults[selectedIndex]);
//         }
//         break;
//       case 'Escape':
//         e.preventDefault();
//         setShowResults(false);
//         setSelectedIndex(-1);
//         inputRef.current?.blur();
//         break;
//     }
//   };

//   // Handle clicking on a search result
//   const handleResultClick = (result: SearchResult) => {
//     navigate(result.path);
//     setSearchQuery("");
//     setShowResults(false);
//     setSearchResults([]);
//     setSelectedIndex(-1);
//   };

//   // Clear search
//   const clearSearch = () => {
//     setSearchQuery("");
//     setSearchResults([]);
//     setShowResults(false);
//     setSelectedIndex(-1);
//     inputRef.current?.focus();
//   };

//   // Click outside handler
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
//         setShowResults(false);
//         setSelectedIndex(-1);
//       }
//     };

//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, []);

//   // Get type badge color
//   const getTypeBadgeColor = (type: string) => {
//     switch (type) {
//       case 'website':
//         return 'bg-blue-100 text-blue-700';
//       case 'report':
//         return 'bg-green-100 text-green-700';
//       case 'post':
//         return 'bg-purple-100 text-purple-700';
//       default:
//         return 'bg-gray-100 text-gray-700';
//     }
//   };

//   return (
//     <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200">
//       {isMobile && (
//         <button
//           onClick={() => setIsOpen(true)}
//           className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
//         >
//           <Menu className="w-5 h-5" />
//         </button>
//       )}

//       <div className="flex-1 px-4 flex justify-between items-center">
//         <div className="flex-1 flex">
//           <div className="w-full flex md:ml-0">
//             <div className="relative w-full max-w-lg" ref={searchRef}>
//               {/* Search Input */}
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//                   <Search className={cn(
//                     "w-5 h-5 transition-colors",
//                     searchQuery ? "text-gray-600" : "text-gray-400"
//                   )} />
//                 </div>
//                 <Input
//                   ref={inputRef}
//                   type="text"
//                   value={searchQuery}
//                   onChange={handleSearchChange}
//                   onKeyDown={handleKeyDown}
//                   onFocus={() => searchQuery && setShowResults(true)}
//                   placeholder="Search websites, reports, posts..."
//                   className="w-full pl-10 pr-10 py-2 border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
//                 />
//                 {searchQuery && (
//                   <button
//                     onClick={clearSearch}
//                     className="absolute inset-y-0 right-0 flex items-center pr-3"
//                   >
//                     <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
//                   </button>
//                 )}
//               </div>

//               {/* Search Results Dropdown */}
//               {showResults && (
//                 <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
//                   {isSearching ? (
//                     <div className="p-4 text-center text-gray-500">
//                       <div className="inline-flex items-center">
//                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mr-2"></div>
//                         Searching...
//                       </div>
//                     </div>
//                   ) : searchResults.length > 0 ? (
//                     <div className="max-h-96 overflow-y-auto">
//                       {searchResults.map((result, index) => (
//                         <button
//                           key={`${result.type}-${result.id}`}
//                           onClick={() => handleResultClick(result)}
//                           onMouseEnter={() => setSelectedIndex(index)}
//                           className={cn(
//                             "w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors text-left",
//                             selectedIndex === index && "bg-gray-50"
//                           )}
//                         >
//                           <div className="flex-shrink-0 text-gray-400">
//                             {result.icon}
//                           </div>
//                           <div className="flex-1 min-w-0">
//                             <div className="flex items-center space-x-2">
//                               <p className="text-sm font-medium text-gray-900 truncate">
//                                 {result.title}
//                               </p>
//                               <span className={cn(
//                                 "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
//                                 getTypeBadgeColor(result.type)
//                               )}>
//                                 {result.type}
//                               </span>
//                             </div>
//                             {result.subtitle && (
//                               <p className="text-xs text-gray-500 truncate mt-0.5">
//                                 {result.subtitle}
//                               </p>
//                             )}
//                           </div>
//                           <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
//                         </button>
//                       ))}
//                     </div>
//                   ) : searchQuery.trim() ? (
//                     <div className="p-8 text-center">
//                       <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
//                       <p className="text-sm text-gray-500">
//                         No results found for "{searchQuery}"
//                       </p>
//                       <p className="text-xs text-gray-400 mt-1">
//                         Try searching with different keywords
//                       </p>
//                     </div>
//                   ) : null}

//                   {/* Quick Actions */}
//                   {searchResults.length > 0 && (
//                     <div className="border-t border-gray-200 p-2 bg-gray-50">
//                       <div className="flex items-center justify-between px-2">
//                         <span className="text-xs text-gray-500">
//                           Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">↵</kbd> to select • <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">ESC</kbd> to close
//                         </span>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}

//             </div>
//           </div>
//         </div>

//         <div className="ml-2 sm:ml-4 flex items-center md:ml-6 space-x-2 sm:space-x-4">
//           <ActivityBellSimple />

//           {/* Add Website Dialog */}
//           <Dialog open={isAddWebsiteOpen} onOpenChange={setIsAddWebsiteOpen}>
//             <DialogTrigger asChild>
//               <Button className="bg-primary-500 hover:bg-primary-600 text-white px-2 sm:px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-1 sm:space-x-2">
//                 <Plus className="w-4 h-4" />
//                 {!isMobile && <span>Add Website</span>}
//               </Button>
//             </DialogTrigger>
//             <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
//               <AddWebsiteForm onSuccess={() => setIsAddWebsiteOpen(false)} />
//             </DialogContent>
//           </Dialog>
//         </div>
//       </div>
//     </div>
//   );
// }