

//client/src/pages/content-schedule.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileText,
  Loader2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

// Utility functions for date handling
const formatDate = (date: Date, formatStr: string) => {
  if (formatStr === "MMM dd, yyyy") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }
  if (formatStr === "yyyy-MM-dd") {
    return date.toISOString().split("T")[0];
  }
  if (formatStr === "HH:mm") {
    return date.toTimeString().slice(0, 5);
  }
  return date.toLocaleDateString();
};

const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const isTomorrow = (date: Date) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
};

const isPast = (date: Date) => {
  return date < new Date();
};

const getStatusBadge = (status: string, date: Date) => {
  if (status === "published") {
    return <Badge className="bg-green-100 text-green-800">Published</Badge>;
  }
  if (status === "publishing") {
    return <Badge className="bg-yellow-100 text-yellow-800">Publishing</Badge>;
  }
  if (status === "failed") {
    return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
  }
  if (status === "cancelled") {
    return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
  }
  if (isPast(date) && status === "scheduled") {
    return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
  }
  if (isToday(date)) {
    return <Badge className="bg-blue-100 text-blue-800">Today</Badge>;
  }
  if (isTomorrow(date)) {
    return <Badge className="bg-yellow-100 text-yellow-800">Tomorrow</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-800">Scheduled</Badge>;
};

const getDateLabel = (date: Date) => {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return formatDate(date, "MMM dd, yyyy");
};

// Get today's date in YYYY-MM-DD format
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

// Get tomorrow's date in YYYY-MM-DD format
const getTomorrowString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

// Helper functions for data normalization
const getContentTitle = (content: any) => {
  return (
    content.contentTitle ||
    content.title ||
    content.topic ||
    content.name ||
    "Untitled Content"
  );
};

const getContentExcerpt = (content: any) => {
  return content.contentExcerpt || content.excerpt || content.description || "";
};

// Simple date input component that bypasses UI library
const DateInput = ({ value, onChange, min, className = "", ...props }) => {
  return (
    <input
      type="date"
      value={value}
      onChange={onChange}
      min={min}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${className}`}
      style={{
        colorScheme: "light",
        WebkitAppearance: "none",
        MozAppearance: "textfield",
      }}
      {...props}
    />
  );
};

// Simple time input component that bypasses UI library
const TimeInput = ({ value, onChange, className = "", ...props }) => {
  return (
    <input
      type="time"
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${className}`}
      style={{
        colorScheme: "light",
        WebkitAppearance: "none",
        MozAppearance: "textfield",
      }}
      {...props}
    />
  );
};

export default function ContentSchedule() {
  const [selectedWebsite, setSelectedWebsite] = useState<string>("all");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [publishLoading, setPublishLoading] = useState<string | null>(null);

  // Form state - initialize with tomorrow's date and 9 AM
  const [formData, setFormData] = useState({
    websiteId: "",
    contentId: "",
    scheduledDate: getTomorrowString(),
    scheduledTime: "09:00",
  });

  const queryClient = useQueryClient();

  // Get websites
  const { data: websites } = useQuery({
    queryKey: ["/api/user/websites"],
    queryFn: api.getWebsites,
  });

  // Get unpublished content for selected website
  const { data: unpublishedContent = [] } = useQuery({
    queryKey: ["unpublished-content", formData.websiteId],
    queryFn: () =>
      formData.websiteId
        ? api.getWebsiteContent(formData.websiteId)
        : Promise.resolve([]),
    enabled: !!formData.websiteId,
  });

  const availableContent = unpublishedContent.filter(
    (content) =>
      content.status === "ready" || content.status === "pending_approval"
  );

  // Get content details for viewing
  const { data: contentDetails = null } = useQuery({
    queryKey: ["content-details", viewingContent?.contentId],
    queryFn: () =>
      viewingContent?.contentId
        ? api.getContentById(viewingContent.contentId)
        : Promise.resolve(null),
    enabled: !!viewingContent?.contentId,
  });

  // Get scheduled content
  const {
    data: scheduledContent = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["scheduled-content", selectedWebsite],
    queryFn: async () => {
      if (selectedWebsite === "all") {
        return api.getAllScheduledContent();
      } else {
        return api.getContentSchedule(selectedWebsite);
      }
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  // Normalize the data structure to handle different API responses
  const normalizedScheduledContent = scheduledContent.map((content: any) => {
    // More explicit title extraction to avoid caching issues
    let title = "Untitled Content";
    if (content.contentTitle) title = content.contentTitle;
    else if (content.title) title = content.title;
    else if (content.topic) title = content.topic;
    else if (content.name) title = content.name;

    let excerpt = "";
    if (content.contentExcerpt) excerpt = content.contentExcerpt;
    else if (content.excerpt) excerpt = content.excerpt;
    else if (content.description) excerpt = content.description;

    return {
      ...content,
      // Ensure we have consistent property names
      contentTitle: title,
      contentExcerpt: excerpt,
    };
  });

  // Create scheduled content mutation
  const createScheduleMutation = useMutation({
    mutationFn: (data: any) =>
      api.scheduleExistingContent(data.websiteId, {
        contentId: data.contentId,
        scheduledDate: `${data.scheduledDate}T${data.scheduledTime}:00`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-content"] });
      setIsScheduleDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Failed to schedule content:", error);
    },
  });

  // Update scheduled content mutation
  const updateScheduleMutation = useMutation({
    mutationFn: (data: any) =>
      api.updateScheduledContent(data.websiteId, data.scheduleId, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-content"] });
      setIsEditDialogOpen(false);
      setEditingSchedule(null);
    },
  });

  // Delete scheduled content mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: (data: { websiteId: string; scheduleId: string }) =>
      api.deleteScheduledContent(data.websiteId, data.scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-content"] });
    },
  });

  // Publish content mutation
  const publishContentMutation = useMutation({
    mutationFn: (data: { contentId: string }) =>
      api.publishContent(data.contentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-content"] });
      setPublishLoading(null);
    },
    onError: () => {
      setPublishLoading(null);
    },
  });

  const resetForm = () => {
    setFormData({
      websiteId: "",
      contentId: "",
      scheduledDate: getTomorrowString(),
      scheduledTime: "09:00",
    });
  };

  const handleCreateSchedule = () => {
    if (!formData.websiteId || !formData.contentId || !formData.scheduledDate) {
      return;
    }
    createScheduleMutation.mutate(formData);
  };

  const handleEditSchedule = (schedule: any) => {
    setEditingSchedule(schedule);
    const scheduleDate = new Date(schedule.scheduledDate);
    setFormData({
      websiteId: schedule.websiteId,
      contentId: schedule.contentId,
      scheduledDate: formatDate(scheduleDate, "yyyy-MM-dd"),
      scheduledTime: formatDate(scheduleDate, "HH:mm"),
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateSchedule = () => {
    if (!editingSchedule || !formData.scheduledDate) {
      return;
    }

    updateScheduleMutation.mutate({
      websiteId: editingSchedule.websiteId,
      scheduleId: editingSchedule.id,
      updates: {
        scheduledDate: `${formData.scheduledDate}T${formData.scheduledTime}:00`,
      },
    });
  };

  const handleDeleteSchedule = (schedule: any) => {
    if (
      confirm(`Are you sure you want to unschedule "${schedule.contentTitle}"?`)
    ) {
      deleteScheduleMutation.mutate({
        websiteId: schedule.websiteId,
        scheduleId: schedule.id,
      });
    }
  };

  const handlePublishNow = (schedule: any) => {
    setPublishLoading(schedule.id);
    publishContentMutation.mutate({
      contentId: schedule.contentId,
    });
  };

  const handleViewContent = (schedule: any) => {
    setViewingContent(schedule);
    setViewDialogOpen(true);
  };

  // Initialize form when dialog opens
  const handleDialogOpen = (open: boolean) => {
    setIsScheduleDialogOpen(open);
    if (open) {
      resetForm();
    }
  };

  // Calculate stats using normalized data
  const filteredContent =
    selectedWebsite === "all"
      ? normalizedScheduledContent
      : normalizedScheduledContent.filter(
          (content: any) => content.websiteId === selectedWebsite
        );

  const getWebsiteName = (websiteId: string) => {
    const website = websites?.find((w) => w.id === websiteId);
    return website?.name || "Unknown Website";
  };

  const scheduledCount = filteredContent.filter(
    (c: any) => c.status === "scheduled" && !isPast(new Date(c.scheduledDate))
  ).length;

  const publishedCount = filteredContent.filter(
    (c: any) => c.status === "published"
  ).length;

  const overdueCount = filteredContent.filter(
    (c: any) => c.status === "scheduled" && isPast(new Date(c.scheduledDate))
  ).length;

  const activeWebsites =
    websites?.filter((w) =>
      normalizedScheduledContent.some((s: any) => s.websiteId === w.id)
    ).length || 0;

  if (error) {
    return (
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Error loading scheduled content
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {error instanceof Error
                ? error.message
                : "Please try again later"}
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Content Schedule
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Schedule your generated content for publication
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Dialog open={isScheduleDialogOpen} onOpenChange={handleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary-500 hover:bg-primary-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Content
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] bg-white border shadow-lg">
                <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Schedule Content for Publication
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Website Selection */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="website"
                      className="text-sm font-medium text-gray-700"
                    >
                      Website
                    </Label>
                    <Select
                      value={formData.websiteId}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          websiteId: value,
                          contentId: "",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full border border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select website" />
                      </SelectTrigger>
                      <SelectContent>
                        {websites?.map((website) => (
                          <SelectItem key={website.id} value={website.id}>
                            {website.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Content Selection */}
                  {formData.websiteId && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="content"
                        className="text-sm font-medium text-gray-700"
                      >
                        Content to Schedule
                      </Label>
                      <Select
                        value={formData.contentId}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, contentId: value }))
                        }
                      >
                        <SelectTrigger className="w-full border border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="Select content to schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableContent.map((content) => (
                            <SelectItem key={content.id} value={content.id}>
                              {content.title} ({content.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {availableContent.length === 0 && (
                        <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                          No unpublished content available. Generate some
                          content first.
                        </p>
                      )}
                    </div>
                  )}

                  {formData.contentId && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md border">
                      {(() => {
                        const selectedContent = availableContent.find(
                          (c) => c.id === formData.contentId
                        );
                        return selectedContent ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-sm">
                                {selectedContent.title}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {selectedContent.status}
                              </Badge>
                            </div>
                            {selectedContent.excerpt && (
                              <p className="text-xs text-gray-600 pl-6">
                                {selectedContent.excerpt.substring(0, 100)}...
                              </p>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {/* Date and Time Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="date"
                        className="text-sm font-medium text-gray-700"
                      >
                        Publish Date
                      </Label>
                      <DateInput
                        value={formData.scheduledDate}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            scheduledDate: e.target.value,
                          }))
                        }
                        min={getTodayString()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="time"
                        className="text-sm font-medium text-gray-700"
                      >
                        Publish Time
                      </Label>
                      <TimeInput
                        value={formData.scheduledTime}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            scheduledTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsScheduleDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      onClick={handleCreateSchedule}
                      disabled={
                        createScheduleMutation.isPending ||
                        !formData.websiteId ||
                        !formData.contentId ||
                        !formData.scheduledDate
                      }
                    >
                      {createScheduleMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        "Schedule"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Website Filter */}
        <div className="mb-6">
          <Select value={selectedWebsite} onValueChange={setSelectedWebsite}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All websites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All websites</SelectItem>
              {websites?.map((website) => (
                <SelectItem key={website.id} value={website.id}>
                  {website.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Schedule Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {scheduledCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">Awaiting publication</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {publishedCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Successfully published
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {overdueCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Missed publication time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Websites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {activeWebsites}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                With scheduled content
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Content List */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Content</CardTitle>
            <CardDescription>
              Content scheduled for automatic publication
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">
                  Loading scheduled content...
                </span>
              </div>
            ) : filteredContent.length > 0 ? (
              <div className="space-y-4">
                {filteredContent
                  .sort(
                    (a: any, b: any) =>
                      new Date(a.scheduledDate).getTime() -
                      new Date(b.scheduledDate).getTime()
                  )
                  .map((content: any) => (
                    <div
                      key={content.id}
                      className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900">
                              {content.contentTitle}
                            </h3>
                            {getStatusBadge(
                              content.status,
                              new Date(content.scheduledDate)
                            )}
                          </div>

                          {content.contentExcerpt && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {content.contentExcerpt}
                            </p>
                          )}

                          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                            <span className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {getDateLabel(new Date(content.scheduledDate))}
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDate(
                                new Date(content.scheduledDate),
                                "HH:mm"
                              )}
                            </span>
                            <span>
                              Website:{" "}
                              {content.websiteName ||
                                getWebsiteName(content.websiteId)}
                            </span>
                          </div>

                          {content.seoKeywords &&
                            content.seoKeywords.length > 0 && (
                              <div className="flex items-center space-x-1 mt-2">
                                {content.seoKeywords
                                  .slice(0, 3)
                                  .map((keyword: string) => (
                                    <Badge
                                      key={keyword}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {keyword}
                                    </Badge>
                                  ))}
                                {content.seoKeywords.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{content.seoKeywords.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewContent(content)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>

                          {content.status === "scheduled" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePublishNow(content)}
                                disabled={publishLoading === content.id}
                              >
                                {publishLoading === content.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  "Publish Now"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSchedule(content)}
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </>
                          )}

                          {content.status !== "published" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteSchedule(content)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}

                          {content.status === "published" && (
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              <span className="text-sm">Published</span>
                            </div>
                          )}

                          {content.status === "scheduled" &&
                            isPast(new Date(content.scheduledDate)) && (
                              <div className="flex items-center text-red-600">
                                <AlertCircle className="w-4 h-4 mr-1" />
                                <span className="text-sm">Overdue</span>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No scheduled content
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedWebsite !== "all"
                    ? "No content scheduled for this website."
                    : "Start by scheduling some of your generated content."}
                </p>
                <div className="mt-6">
                  <Button
                    onClick={() => setIsScheduleDialogOpen(true)}
                    className="bg-primary-500 hover:bg-primary-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Content
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-lg bg-white border shadow-lg">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Edit Publication Schedule
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="edit-date"
                    className="text-sm font-medium text-gray-700"
                  >
                    Publish Date
                  </Label>
                  <DateInput
                    value={formData.scheduledDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        scheduledDate: e.target.value,
                      }))
                    }
                    min={getTodayString()}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="edit-time"
                    className="text-sm font-medium text-gray-700"
                  >
                    Publish Time
                  </Label>
                  <TimeInput
                    value={formData.scheduledTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        scheduledTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  onClick={handleUpdateSchedule}
                  disabled={
                    updateScheduleMutation.isPending || !formData.scheduledDate
                  }
                >
                  {updateScheduleMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Content Dialog - FIXED VERSION */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-4xl h-[90vh] bg-white border shadow-lg flex flex-col">
            <DialogHeader className="border-b pb-4 flex-shrink-0">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Content Preview
              </DialogTitle>
            </DialogHeader>

            {/* Scrollable content area with fixed height */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {viewingContent && (
                <>
                  {/* Fixed Header Section */}
                  <div className="flex-shrink-0 space-y-4 p-4 border-b bg-gray-50">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {viewingContent.contentTitle}
                      </h2>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Scheduled:{" "}
                          {getDateLabel(
                            new Date(viewingContent.scheduledDate)
                          )}{" "}
                          at{" "}
                          {formatDate(
                            new Date(viewingContent.scheduledDate),
                            "HH:mm"
                          )}
                        </span>
                        <span>
                          Website:{" "}
                          {viewingContent.websiteName ||
                            getWebsiteName(viewingContent.websiteId)}
                        </span>
                        <span>Status: {viewingContent.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content Body */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {contentDetails ? (
                      <div className="prose max-w-none">
                        {contentDetails.content ? (
                          <div
                            className="text-sm text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: contentDetails.content,
                            }}
                          />
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No content available
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">
                          Loading content...
                        </span>
                      </div>
                    )}

                    {/* Meta Information */}
                    {contentDetails && (
                      <div className="mt-8 pt-4 border-t grid grid-cols-2 gap-4 text-xs text-gray-500">
                        {contentDetails.wordCount && (
                          <div>
                            <span className="font-medium">Word Count:</span>{" "}
                            {contentDetails.wordCount}
                          </div>
                        )}
                        {contentDetails.readingTime && (
                          <div>
                            <span className="font-medium">Reading Time:</span>{" "}
                            {contentDetails.readingTime} min
                          </div>
                        )}
                        {contentDetails.createdAt && (
                          <div>
                            <span className="font-medium">Created:</span>{" "}
                            {formatDate(
                              new Date(contentDetails.createdAt),
                              "MMM dd, yyyy"
                            )}
                          </div>
                        )}
                        {contentDetails.lastModified && (
                          <div>
                            <span className="font-medium">Modified:</span>{" "}
                            {formatDate(
                              new Date(contentDetails.lastModified),
                              "MMM dd, yyyy"
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fixed Footer with Action Buttons */}
                  <div className="flex-shrink-0 border-t bg-gray-50 p-4">
                    <div className="flex justify-end space-x-3">
                      {viewingContent?.status === "scheduled" && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setViewDialogOpen(false);
                              handleEditSchedule(viewingContent);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Schedule
                          </Button>
                          <Button
                            onClick={() => {
                              setViewDialogOpen(false);
                              handlePublishNow(viewingContent);
                            }}
                            disabled={publishLoading === viewingContent?.id}
                          >
                            {publishLoading === viewingContent?.id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Publishing...
                              </>
                            ) : (
                              "Publish Now"
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
