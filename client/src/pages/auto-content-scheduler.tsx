//client/src/pages/auto-content-scheduler.tsx
import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Settings,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Bot,
  Sparkles,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Target,
  Cpu,
} from "lucide-react";

// API functions for auto-generation
const autoGenApi = {
  async getSchedules(websiteId?: string) {
    const url = websiteId ? `/api/user/auto-schedules?websiteId=${websiteId}` : '/api/user/auto-schedules';
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('Auto-schedules API not implemented yet');
        return [];
      }
      throw new Error('Failed to fetch schedules');
    }
    
    const data = await response.json();
    return data.schedules || data || [];
  },

  async createSchedule(data: any) {
    const response = await fetch('/api/user/auto-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create schedule');
    }
    
    return response.json();

  },

  async updateSchedule(scheduleId: string, data: any) {
    const response = await fetch(`/api/user/auto-schedules/${scheduleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to update schedule');
    }
    
    return response.json();
  },

  async deleteSchedule(scheduleId: string) {
    const response = await fetch(`/api/user/auto-schedules/${scheduleId}`, {
      method: "DELETE",
    });

    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to delete schedule');
    }
    

    return response.json();
  },

  async toggleSchedule(scheduleId: string, isActive: boolean) {

    const response = await fetch(`/api/user/auto-schedules/${scheduleId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to toggle schedule');
    }
    

    return response.json();
  },

  async runScheduleNow(scheduleId: string) {
    const response = await fetch(`/api/user/auto-schedules/${scheduleId}/run`, {
      method: "POST",
    });

    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to run schedule');
    }
    

    return response.json();
  },
};

const frequencyOptions = [
  { value: "daily", label: "Daily", description: "Generate content every day" },
  {
    value: "twice_weekly",
    label: "Twice a Week",
    description: "Monday & Thursday",
  },
  { value: "weekly", label: "Weekly", description: "Once per week" },
  {
    value: "biweekly",
    label: "Every 2 Weeks",
    description: "Every other week",
  },
  { value: "monthly", label: "Monthly", description: "Once per month" },
  {
    value: "custom",
    label: "Custom Schedule",
    description: "Set specific days",
  },
];

const dayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case "openai":
      return <Cpu className="w-4 h-4 text-green-600" />;
    case "anthropic":
      return <Bot className="w-4 h-4 text-purple-600" />;
    case "gemini":
      return <Sparkles className="w-4 h-4 text-blue-600" />;
    default:
      return <Bot className="w-4 h-4 text-gray-600" />;
  }
};

const getProviderName = (provider: string) => {
  switch (provider) {

    case 'openai':
      return 'OpenAI GPT-4';
    case 'anthropic':
      return 'Anthropic Claude';
    case 'gemini':
      return 'Google Gemini';
    default:
      return provider || 'Default AI';

  }
};

interface AutoContentSchedulerProps {
  websites: any[];
  selectedWebsite: string;
  onScheduleCreated?: () => void;
}

export default function AutoContentScheduler({
  websites,
  selectedWebsite,
  onScheduleCreated,
}: AutoContentSchedulerProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);
  const [toast, setToast] = useState<any>(null);

  // Form state for creating new schedule
  const [scheduleForm, setScheduleForm] = useState({
    websiteId: selectedWebsite || "",
    name: "",
    frequency: "weekly",
    customDays: [] as string[],

    timeOfDay: '09:00',
    
    // Content settings
    topics: [] as string[],
    topicRotation: 'random',
    keywords: '',
    tone: 'professional',
    wordCount: 800,
    seoOptimized: true,
    brandVoice: "",
    targetAudience: "",
    eatCompliance: false,
    aiProvider: "openai",

    // Image settings
    includeImages: false,
    imageCount: 1,
    imageStyle: "natural",
    autoPublish: true,
    publishDelay: 0,
    
    // Limits
    maxMonthlyPosts: 30,
    maxDailyCost: 5.00,
    
    isActive: true
  });

  const [formErrors, setFormErrors] = useState<any>({});
  const [topicInput, setTopicInput] = useState("");

  useEffect(() => {
    loadSchedules();
  }, [selectedWebsite]);

  useEffect(() => {
    if (selectedWebsite) {
      setScheduleForm((prev) => ({ ...prev, websiteId: selectedWebsite }));
    }
  }, [selectedWebsite]);

  const loadSchedules = async () => {

    try {
      setIsLoading(true);
      const data = await autoGenApi.getSchedules(selectedWebsite);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error: any) {

      console.error('Error loading schedules:', error);

      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const showToastMessage = (
    title: string,
    description: string,
    variant = "default"
  ) => {
    setToast({ title, description, variant });
    setTimeout(() => setToast(null), 5000);
  };

  const validateForm = () => {
    const errors: any = {};

    if (!scheduleForm.websiteId) errors.websiteId = "Please select a website";
    if (!scheduleForm.name.trim()) errors.name = "Schedule name is required";
    if (scheduleForm.topics.length === 0)
      errors.topics = "At least one topic is required";
    if (
      scheduleForm.frequency === "custom" &&
      scheduleForm.customDays.length === 0
    ) {
      errors.customDays = "Please select at least one day for custom schedule";
    }
    if (scheduleForm.wordCount < 100 || scheduleForm.wordCount > 5000) {
      errors.wordCount = "Word count must be between 100 and 5000";
    }
    if (scheduleForm.maxDailyCost < 0.01 || scheduleForm.maxDailyCost > 100) {
      errors.maxDailyCost = "Daily cost limit must be between $0.01 and $100";
    }

    if (scheduleForm.includeImages) {
      if (scheduleForm.imageCount < 1 || scheduleForm.imageCount > 3) {
        errors.imageCount = "Image count must be between 1 and 3";
      }

    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddTopic = () => {
    if (topicInput.trim() && !scheduleForm.topics.includes(topicInput.trim())) {
      setScheduleForm((prev) => ({
        ...prev,
        topics: [...prev.topics, topicInput.trim()],
      }));
      setTopicInput("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topic),
    }));
  };

  const handleCreateSchedule = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const result = await autoGenApi.createSchedule(scheduleForm);
      await loadSchedules();
      setShowCreateDialog(false);
      resetForm();
      showToastMessage(
        "Schedule Created",
        scheduleForm.autoPublish && scheduleForm.publishDelay === 0 
          ? "Your auto-generation schedule has been created with immediate publishing"
          : "Your auto-generation schedule has been created successfully"
      );
      if (onScheduleCreated) onScheduleCreated();
    } catch (error: any) {
      showToastMessage(
        "Failed to create schedule",
        error.message,
        "destructive"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleSchedule = async (
    scheduleId: string,
    currentStatus: boolean
  ) => {
    try {
      await autoGenApi.toggleSchedule(scheduleId, !currentStatus);
      await loadSchedules();
      showToastMessage(
        currentStatus ? "Schedule Paused" : "Schedule Activated",
        currentStatus
          ? "Auto-generation has been paused"
          : "Auto-generation has been activated"
      );
    } catch (error: any) {
      showToastMessage(
        "Failed to toggle schedule",
        error.message,
        "destructive"
      );
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    try {
      const result = await autoGenApi.runScheduleNow(scheduleId);
      showToastMessage('Generation Started', 'Content generation has been triggered');

      await loadSchedules();
    } catch (error: any) {
      showToastMessage("Failed to run schedule", error.message, "destructive");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      await autoGenApi.deleteSchedule(scheduleId);
      await loadSchedules();
      showToastMessage("Schedule Deleted", "The schedule has been removed");
    } catch (error: any) {
      showToastMessage(
        "Failed to delete schedule",
        error.message,
        "destructive"
      );
    }
  };

  const resetForm = () => {
    setScheduleForm({
      websiteId: selectedWebsite || "",
      name: "",
      frequency: "weekly",
      customDays: [],
      timeOfDay: '09:00',
      topics: [],
      topicRotation: "random",
      keywords: "",
      tone: "professional",
      wordCount: 800,
      seoOptimized: true,
      brandVoice: "",
      targetAudience: "",
      eatCompliance: false,
      aiProvider: "openai",
      includeImages: false,
      imageCount: 1,
      imageStyle: "natural",
      autoPublish: true,
      publishDelay: 0,
      maxMonthlyPosts: 30,
      maxDailyCost: 5.0,
      isActive: true,
    });
    setTopicInput("");
    setFormErrors({});
    setShowAdvancedSettings(false);
  };

  const getNextRunTime = (schedule: any) => {
    if (!schedule.isActive) return 'Schedule paused';
    
    const now = new Date();
    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, set to tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    // Adjust based on frequency
    if (schedule.frequency === 'weekly' || schedule.frequency === 'biweekly') {
      const dayMap: any = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
      const targetDay = dayMap['Monday']; // Default to Monday
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
    } else if (schedule.frequency === 'monthly') {
      next.setDate(1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }
    
    return next.toLocaleString();
  };

  const getFrequencyLabel = (frequency: string, customDays?: string[]) => {
    if (frequency === "custom" && customDays?.length > 0) {
      return `Custom (${customDays.join(", ")})`;
    }
    return (
      frequencyOptions.find((f) => f.value === frequency)?.label || frequency
    );
  };

  // Format cost to display properly
  const formatCost = (cost: any) => {
    const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;
    return isNaN(numCost) ? '0.00' : numCost.toFixed(2);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border max-w-md ${
            toast.variant === "destructive"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-1">
              <div className="font-medium text-sm">{toast.title}</div>
              <div className="text-xs opacity-90 mt-1">{toast.description}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-3 opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Auto-Generation Schedules
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Automatically generate and publish content on a schedule
            </p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            disabled={!selectedWebsite}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Create Schedule
          </button>
        </div>

        {/* Schedules List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : schedules.length > 0 ? (
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="border rounded-lg overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">
                          {schedule.name}
                        </h4>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            schedule.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {schedule.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 mr-1" />
                              Paused
                            </>
                          )}
                        </span>
                        {getProviderIcon(schedule.aiProvider)}
                        <span className="text-xs text-gray-500">
                          {getProviderName(schedule.aiProvider)}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {getFrequencyLabel(
                            schedule.frequency,
                            schedule.customDays
                          )}
                        </span>
                        <span>•</span>
                        <span>{schedule.topics?.length || 0} topics</span>
                        <span>•</span>
                        <span>{schedule.wordCount} words</span>
                        {schedule.includeImages && (
                          <>
                            <span>•</span>
                            <span className="text-orange-600">
                              {schedule.imageCount} image
                              {schedule.imageCount > 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                        {schedule.autoPublish && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">
                              {schedule.publishDelay === 0 
                                ? 'Auto-publish (immediate)' 
                                : `Auto-publish (${schedule.publishDelay}h delay)`}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        Next run: {getNextRunTime(schedule)}
                      </div>

                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRunNow(schedule.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Run now"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleSchedule(schedule.id, schedule.isActive)
                        }
                        className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                        title={schedule.isActive ? "Pause" : "Activate"}
                      >
                        {schedule.isActive ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setExpandedSchedule(
                            expandedSchedule === schedule.id
                              ? null
                              : schedule.id
                          )
                        }
                        className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                      >
                        {expandedSchedule === schedule.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedSchedule === schedule.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Topics:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {schedule.topics?.map(
                              (topic: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800"
                                >
                                  {topic}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-500">Settings:</span>
                          <div className="mt-1 space-y-1 text-xs">
                            <div>Max monthly posts: {schedule.maxMonthlyPosts}</div>
                            <div>Daily cost limit: ${formatCost(schedule.maxDailyCost)}</div>
                            <div>Time: {schedule.timeOfDay}</div>
                            <div>Posts this month: {schedule.postsThisMonth || 0}</div>
                            <div>Cost today: ${formatCost(schedule.costToday || 0)}</div>
                            {schedule.autoPublish && (
                              <div className="text-green-600">
                                Publishing: {schedule.publishDelay === 0 ? 'Immediate' : `After ${schedule.publishDelay}h`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="text-xs text-gray-500">
                          Created:{" "}
                          {new Date(schedule.createdAt).toLocaleDateString()}
                          {schedule.lastRun &&
                            ` • Last run: ${new Date(
                              schedule.lastRun
                            ).toLocaleDateString()}`}
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete Schedule
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No schedules yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {selectedWebsite ? 'Create a schedule to automatically generate content' : 'Select a website first'}
            </p>
            {selectedWebsite && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Create First Schedule
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Schedule Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => setShowCreateDialog(false)}
            ></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Create Auto-Generation Schedule
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Set up automatic content generation with AI
                  </p>
                </div>

                
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">

                  {/* Basic Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Schedule Name *
                      </label>
                      <input
                        type="text"
                        value={scheduleForm.name}
                        onChange={(e) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., Weekly Blog Posts"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {formErrors.name && (
                        <p className="text-sm text-red-600 mt-1">
                          {formErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Website *
                      </label>
                      <select
                        value={scheduleForm.websiteId}
                        onChange={(e) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            websiteId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select website</option>
                        {websites?.map((website) => (
                          <option key={website.id} value={website.id}>
                            {website.name}
                          </option>
                        ))}
                      </select>
                      {formErrors.websiteId && (
                        <p className="text-sm text-red-600 mt-1">
                          {formErrors.websiteId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Frequency Settings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Generation Frequency *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {frequencyOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setScheduleForm((prev) => ({
                              ...prev,
                              frequency: option.value,
                            }))
                          }
                          className={`p-3 border-2 rounded-lg text-left transition-all ${
                            scheduleForm.frequency === option.value
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="font-medium text-sm">
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {option.description}
                          </div>
                        </button>
                      ))}
                    </div>

                    {scheduleForm.frequency === "custom" && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Days
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {dayOptions.map((day) => (
                            <label key={day} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={scheduleForm.customDays.includes(day)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setScheduleForm((prev) => ({
                                      ...prev,
                                      customDays: [...prev.customDays, day],
                                    }));
                                  } else {
                                    setScheduleForm((prev) => ({
                                      ...prev,
                                      customDays: prev.customDays.filter(
                                        (d) => d !== day
                                      ),
                                    }));
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600"
                              />
                              <span className="ml-2 text-sm">{day}</span>
                            </label>
                          ))}
                        </div>
                        {formErrors.customDays && (
                          <p className="text-sm text-red-600 mt-1">
                            {formErrors.customDays}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time of Day
                      </label>
                      <input
                        type="time"
                        value={scheduleForm.timeOfDay}
                        onChange={(e) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            timeOfDay: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Word Count</label>
                      <input
                        type="number"
                        value={scheduleForm.wordCount}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, wordCount: parseInt(e.target.value) || 800 }))}
                        min="100"
                        max="5000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      {formErrors.wordCount && (
                        <p className="text-sm text-red-600 mt-1">{formErrors.wordCount}</p>
                      )}
                    </div>
                  </div>

                  {/* Topics */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Topics *
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), handleAddTopic())
                        }
                        placeholder="Enter a topic and press Enter"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddTopic}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {scheduleForm.topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {topic}
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(topic)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    {formErrors.topics && (
                      <p className="text-sm text-red-600 mt-1">
                        {formErrors.topics}
                      </p>
                    )}
                  </div>

                  {/* AI Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
                    <select
                      value={scheduleForm.aiProvider}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, aiProvider: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="openai">OpenAI GPT-4O</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="gemini">Google Gemini</option>
                    </select>

                  </div>

                  {/* Advanced Settings Toggle */}
                  <div className="border-t pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        setShowAdvancedSettings(!showAdvancedSettings)
                      }
                      className="flex items-center text-sm text-blue-600 hover:text-blue-500"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Advanced Settings
                      {showAdvancedSettings ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </button>

                    {showAdvancedSettings && (
                      <div className="mt-4 space-y-4 pl-5 border-l-2 border-blue-100">
                        {/* Additional Settings */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                            <select
                              value={scheduleForm.tone}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({
                                  ...prev,
                                  tone: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="professional">Professional</option>
                              <option value="casual">Casual</option>
                              <option value="friendly">Friendly</option>
                              <option value="authoritative">Authoritative</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Topic Rotation</label>
                            <select
                              value={scheduleForm.topicRotation}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, topicRotation: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="random">Random</option>
                              <option value="sequential">Sequential</option>
                            </select>
                          </div>
                        </div>

                        {/* Image Settings */}
                        <div className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={scheduleForm.includeImages}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, includeImages: e.target.checked }))}
                              className="rounded border-gray-300 text-orange-600"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">Generate Images with DALL-E 3</span>
                          </label>
                          
                          {scheduleForm.includeImages && (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Number of Images</label>
                                <select
                                  value={scheduleForm.imageCount}
                                  onChange={(e) => setScheduleForm(prev => ({ ...prev, imageCount: parseInt(e.target.value) }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                                >
                                  <option value={1}>1 Image</option>
                                  <option value={2}>2 Images</option>
                                  <option value={3}>3 Images</option>
                                </select>
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Image Style</label>
                                <select
                                  value={scheduleForm.imageStyle}
                                  onChange={(e) => setScheduleForm(prev => ({ ...prev, imageStyle: e.target.value }))}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                                >
                                  <option value="natural">Natural</option>
                                  <option value="digital_art">Digital Art</option>
                                  <option value="photographic">Photographic</option>
                                  <option value="cinematic">Cinematic</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={scheduleForm.autoPublish}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({
                                  ...prev,
                                  autoPublish: e.target.checked,
                                  publishDelay: e.target.checked ? 0 : prev.publishDelay,
                                }))
                              }
                              className="rounded border-gray-300 text-green-600"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">
                              Auto-publish immediately after generation
                            </span>
                          </label>

                          {scheduleForm.autoPublish && (
                            <div className="mt-2 text-xs text-green-700 bg-green-100 rounded p-2">
                              <div className="flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Content will be published immediately after AI generation completes
                              </div>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                                  Add publish delay (optional)
                                </summary>
                                <div className="mt-2">
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Delay publication by (hours)
                                  </label>
                                  <input
                                    type="number"
                                    value={scheduleForm.publishDelay}
                                    onChange={(e) =>
                                      setScheduleForm((prev) => ({
                                        ...prev,
                                        publishDelay: Math.max(0, parseInt(e.target.value) || 0),
                                      }))
                                    }
                                    min="0"
                                    max="72"
                                    placeholder="0 (immediate)"
                                    className="w-32 px-2 py-1 text-sm border border-gray-300 rounded-md"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Leave at 0 for immediate publishing
                                  </p>
                                </div>
                              </details>
                            </div>
                          )}
                          {!scheduleForm.autoPublish && (
                            <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              Generated content will be saved as draft and require manual publishing
                            </div>
                          )}
                        </div>

                        {/* Limits */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Max Monthly Posts
                            </label>
                            <input
                              type="number"
                              value={scheduleForm.maxMonthlyPosts}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, maxMonthlyPosts: parseInt(e.target.value) || 30 }))}

                              min="1"
                              max="100"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Daily Cost Limit ($)
                            </label>
                            <input
                              type="number"
                              value={scheduleForm.maxDailyCost}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, maxDailyCost: parseFloat(e.target.value) || 5 }))}
                              min="0.01"
                              max="100"
                              step="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                            {formErrors.maxDailyCost && (
                              <p className="text-sm text-red-600 mt-1">
                                {formErrors.maxDailyCost}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Additional Options */}
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={scheduleForm.seoOptimized}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({
                                  ...prev,
                                  seoOptimized: e.target.checked,
                                }))
                              }
                              className="rounded border-gray-300 text-blue-600"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              SEO Optimized
                            </span>
                          </label>

                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={scheduleForm.eatCompliance}
                              onChange={(e) =>
                                setScheduleForm((prev) => ({
                                  ...prev,
                                  eatCompliance: e.target.checked,
                                }))
                              }
                              className="rounded border-gray-300 text-purple-600"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              E-E-A-T Compliance
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateSchedule}
                  disabled={isCreating}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Create Schedule
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
