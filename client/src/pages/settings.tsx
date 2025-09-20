import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Key, Globe, Bot, Bell, Shield, User, Trash2, Eye, EyeOff, Check, X, Loader2, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

// ADD THIS IMPORT
import { Sanitizer } from "@/utils/inputSanitizer";

// API Key interfaces (keeping existing API key types)
interface UserApiKey {
  id: string;
  provider: string;
  keyName: string;
  maskedKey: string;
  isActive: boolean;
  validationStatus: 'valid' | 'invalid' | 'pending';
  lastValidated?: string;
  createdAt: string;
}

interface ApiKeyFormData {
  provider: string;
  keyName: string;
  apiKey: string;
}

interface ApiKeyStatus {
  providers: {
    openai: {
      configured: boolean;
      keyName?: string;
      lastValidated?: string;
      status: string;
    };
    anthropic: {
      configured: boolean;
      keyName?: string;
      lastValidated?: string;
      status: string;
    };
    google_pagespeed: {
      configured: boolean;
      keyName?: string;
      lastValidated?: string;
      status: string;
    };
  };
}

// Settings interface
interface UserSettings {
  profile: {
    name: string;
    email: string;
    company: string;
    timezone: string;
  };
  notifications: {
    emailReports: boolean;
    contentGenerated: boolean;
    seoIssues: boolean;
    systemAlerts: boolean;
  };
  automation: {
    defaultAiModel: string;
    autoFixSeoIssues: boolean;
    contentGenerationFrequency: string;
    reportGeneration: string;
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
    allowApiAccess: boolean;
  };
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  
  // API Key management state
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState<ApiKeyFormData>({
    provider: '',
    keyName: '',
    apiKey: ''
  });
  const [validatingKeys, setValidatingKeys] = useState<Set<string>>(new Set());
  const [showApiKey, setShowApiKey] = useState(false);

  // Fetch real user settings
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery<UserSettings>({
    queryKey: ["/api/user/settings"],
    queryFn: async () => {
      const response = await fetch("/api/user/settings", {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return response.json();
    },
  });

  const { data: websites } = useQuery({
    queryKey: ["/api/user/websites"],
    queryFn: api.getWebsites,
  });

  // Fetch user API keys
  const { data: userApiKeys, refetch: refetchApiKeys } = useQuery<UserApiKey[]>({
    queryKey: ["/api/user/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/user/api-keys", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch API keys');
      return response.json();
    },
  });

  const { data: apiKeyStatus } = useQuery<ApiKeyStatus>({
    queryKey: ["/api/user/api-keys/status"],
    queryFn: async () => {
      const response = await fetch("/api/user/api-keys/status", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch API key status');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update settings mutation (real API call)
  const updateSettings = useMutation({
    mutationFn: async (newSettings: UserSettings) => {
      const response = await fetch("/api/user/settings", {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newSettings)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update settings');
      }
      
      return response.json();
    },
    onSuccess: (updatedSettings) => {
      // Update the query cache with the new settings
      queryClient.setQueryData(["/api/user/settings"], updatedSettings);
      
      toast({
        title: "Settings Saved",
        description: "Your settings have been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reset settings mutation
  const resetSettings = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/user/settings", {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset settings');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      // Update the query cache with the default settings
      queryClient.setQueryData(["/api/user/settings"], result.settings);
      
      toast({
        title: "Settings Reset",
        description: "Your settings have been reset to defaults.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // API key mutations (keeping existing)
  const addApiKey = useMutation({
    mutationFn: async (keyData: ApiKeyFormData) => {
      const response = await fetch("/api/user/api-keys", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(keyData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add API key');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "API Key Added",
        description: "Your API key has been added and validated successfully.",
      });
      setIsAddingKey(false);
      setNewKeyForm({ provider: '', keyName: '', apiKey: '' });
      refetchApiKeys();
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add API Key",
        description: error.message || "Please check your API key and try again.",
        variant: "destructive",
      });
    },
  });

  const validateApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/user/api-keys/${keyId}/validate`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to validate API key');
      }
      
      return response.json();
    },
    onSuccess: (data, keyId) => {
      toast({
        title: data.isValid ? "Key Valid" : "Key Invalid",
        description: data.isValid ? "API key is working correctly." : data.error,
        variant: data.isValid ? "default" : "destructive",
      });
      refetchApiKeys();
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys/status"] });
    },
  });

  const deleteApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/user/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete API key');
      }
    },
    onSuccess: () => {
      toast({
        title: "API Key Deleted",
        description: "The API key has been removed from your account.",
      });
      refetchApiKeys();
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys/status"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete API Key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // UPDATED: handleSave with sanitization
  const handleSave = () => {
    if (settings) {
      // Sanitize settings before saving
      const sanitizedSettings = {
        profile: {
          name: Sanitizer.sanitizeText(settings.profile.name),
          email: settings.profile.email, // Already validated in updateSetting
          company: Sanitizer.sanitizeText(settings.profile.company),
          timezone: settings.profile.timezone, // From select, safe
        },
        notifications: settings.notifications, // All booleans, safe
        automation: settings.automation, // All from selects or booleans, safe
        security: {
          twoFactorAuth: settings.security.twoFactorAuth,
          sessionTimeout: Math.min(168, Math.max(1, settings.security.sessionTimeout)),
          allowApiAccess: settings.security.allowApiAccess,
        },
      };
      
      updateSettings.mutate(sanitizedSettings);
    }
  };

  const handleReset = () => {
    resetSettings.mutate();
  };

  // UPDATED: updateSetting with sanitization
  const updateSetting = (section: keyof UserSettings, key: string, value: any) => {
    if (!settings) return;
    
    let sanitizedValue = value;
    
    // Apply sanitization based on field type
    if (section === 'profile') {
      switch (key) {
        case 'name':
        case 'company':
          // Sanitize text fields
          sanitizedValue = Sanitizer.sanitizeText(value);
          break;
          
        case 'email':
          // Validate email
          const emailValidation = Sanitizer.sanitizeEmail(value);
          if (!emailValidation.isValid && value !== '') {
            toast({
              title: "Invalid Email",
              description: emailValidation.error || "Please enter a valid email address",
              variant: "destructive",
            });
            return;
          }
          sanitizedValue = emailValidation.sanitized;
          break;
      }
    } else if (section === 'security' && key === 'sessionTimeout') {
      // Sanitize number
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        sanitizedValue = Math.min(168, Math.max(1, numValue));
      }
    }
    
    queryClient.setQueryData(["/api/user/settings"], {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: sanitizedValue,
      },
    });
  };

  // UPDATED: handleAddApiKey with sanitization
  const handleAddApiKey = () => {
    // Sanitize key name
    const sanitizedKeyName = Sanitizer.sanitizeText(newKeyForm.keyName);
    
    if (!newKeyForm.provider || !sanitizedKeyName || !newKeyForm.apiKey) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate key name length
    if (sanitizedKeyName.length < 2 || sanitizedKeyName.length > 100) {
      toast({
        title: "Invalid Key Name",
        description: "Key name must be between 2 and 100 characters.",
        variant: "destructive",
      });
      return;
    }
    
    // Basic API key format validation
    const apiKey = newKeyForm.apiKey.trim();
    if (newKeyForm.provider === 'openai' && !apiKey.startsWith('sk-')) {
      toast({
        title: "Invalid API Key Format",
        description: "OpenAI API keys should start with 'sk-'",
        variant: "destructive",
      });
      return;
    }
    
    if (newKeyForm.provider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
      toast({
        title: "Invalid API Key Format",
        description: "Anthropic API keys should start with 'sk-ant-'",
        variant: "destructive",
      });
      return;
    }
    
    addApiKey.mutate({
      provider: newKeyForm.provider, // From select, safe
      keyName: sanitizedKeyName,
      apiKey: apiKey // Don't alter the API key itself
    });
  };

  const handleValidateKey = (keyId: string) => {
    setValidatingKeys(prev => new Set(prev).add(keyId));
    validateApiKey.mutate(keyId, {
      onFinally: () => {
        setValidatingKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(keyId);
          return newSet;
        });
      }
    });
  };

  const getStatusBadge = (status: string, provider: string) => {
    const providerStatus = apiKeyStatus?.providers?.[provider as keyof typeof apiKeyStatus.providers];
    
    if (!providerStatus?.configured) {
      return <Badge className="bg-gray-100 text-gray-800">Not Configured</Badge>;
    }
    
    if (status === 'valid') {
      return <Badge className="bg-green-100 text-green-800">✔ Active</Badge>;
    } else if (status === 'invalid') {
      return <Badge className="bg-red-100 text-red-800">✗ Invalid</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return <Bot className="w-6 h-6 text-green-600" />;
      case 'anthropic':
        return <Bot className="w-6 h-6 text-blue-600" />;
      case 'google_pagespeed':
        return <Globe className="w-6 h-6 text-orange-600" />;
      default:
        return <Key className="w-6 h-6 text-gray-400" />;
    }
  };

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Add password change mutation
  const changePassword = useMutation({
    mutationFn: api.changePassword,
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordErrors([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Password Change Failed", 
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // UPDATED: validatePasswordForm with enhanced validation
  const validatePasswordForm = (): boolean => {
    const errors: string[] = [];
    
    if (!passwordData.currentPassword) {
      errors.push('Current password is required');
    }
    
    if (!passwordData.newPassword) {
      errors.push('New password is required');
    }
    
    if (!passwordData.confirmPassword) {
      errors.push('Password confirmation is required');
    }
    
    // Check password length limits
    if (passwordData.newPassword && passwordData.newPassword.length > 200) {
      errors.push('Password is too long (maximum 200 characters)');
    }
    
    if (passwordData.newPassword && passwordData.confirmPassword && 
        passwordData.newPassword !== passwordData.confirmPassword) {
      errors.push('New password and confirmation do not match');
    }
    
    if (passwordData.newPassword && passwordData.newPassword.length < 8) {
      errors.push('New password must be at least 8 characters long');
    }
    
    if (passwordData.newPassword && passwordData.currentPassword && 
        passwordData.newPassword === passwordData.currentPassword) {
      errors.push('New password must be different from current password');
    }
    
    // Check for common weak passwords
    const weakPasswords = ['password', '12345678', 'qwerty', 'abc12345', 'password123'];
    if (passwordData.newPassword && weakPasswords.includes(passwordData.newPassword.toLowerCase())) {
      errors.push('This password is too common. Please choose a stronger password');
    }
    
    setPasswordErrors(errors);
    return errors.length === 0;
  };

  // Add form submit handler
  const handlePasswordChange = () => {
    if (!validatePasswordForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    changePassword.mutate(passwordData);
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI GPT-4';
      case 'anthropic':
        return 'Anthropic Claude';
      case 'google_pagespeed':
        return 'Google PageSpeed Insights';
      default:
        return provider;
    }
  };

  // Loading state
  if (settingsLoading) {
    return (
      <div className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (settingsError || !settings) {
    return (
      <div className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load settings. Please refresh the page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Settings
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your account, integrations, and automation preferences
            </p>
          </div>
          <div className="mt-4 flex gap-2 md:mt-0 md:ml-4">
            <Button 
              variant="outline"
              onClick={handleReset} 
              disabled={resetSettings.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {resetSettings.isPending ? "Resetting..." : "Reset to Defaults"}
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateSettings.isPending}
              className="bg-primary-500 hover:bg-primary-600"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="integrations">API Keys</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            {/* <TabsTrigger value="notifications">Notifications</TabsTrigger> */}
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={settings.profile.name}
                      onChange={(e) => updateSetting("profile", "name", e.target.value)}
                      maxLength={100}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.profile.email}
                      onChange={(e) => updateSetting("profile", "email", e.target.value)}
                      maxLength={254}
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={settings.profile.company}
                    onChange={(e) => updateSetting("profile", "company", e.target.value)}
                    maxLength={200}
                    placeholder="Your company name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.profile.timezone}
                    onValueChange={(value) => updateSetting("profile", "timezone", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys (Integrations) - Complete Implementation */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Key className="w-5 h-5 mr-2" />
                    Your API Keys
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setIsAddingKey(true)}
                    disabled={isAddingKey}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add API Key
                  </Button>
                </CardTitle>
                <CardDescription>
                  Securely store and manage your AI service API keys. Keys are encrypted and never visible in full.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New API Key Form */}
                {isAddingKey && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium mb-4">Add New API Key</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="provider">Service Provider</Label>
                        <Select
                          value={newKeyForm.provider}
                          onValueChange={(value) => setNewKeyForm(prev => ({ ...prev, provider: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                            <SelectItem value="google_pagespeed">Google PageSpeed Insights</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="keyName">Key Name</Label>
                        <Input
                          id="keyName"
                          placeholder="e.g., My OpenAI Key"
                          value={newKeyForm.keyName}
                          onChange={(e) => {
                            // Sanitize on input
                            const sanitized = Sanitizer.sanitizeText(e.target.value);
                            setNewKeyForm(prev => ({ ...prev, keyName: sanitized }));
                          }}
                          maxLength={100}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          A friendly name to identify this key (2-100 characters)
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="apiKey">API Key</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            id="apiKey"
                            type={showApiKey ? "text" : "password"}
                            placeholder={
                              newKeyForm.provider === 'openai' ? 'sk-...' :
                              newKeyForm.provider === 'anthropic' ? 'sk-ant-...' :
                              'AIza...'
                            }
                            value={newKeyForm.apiKey}
                            onChange={(e) => setNewKeyForm(prev => ({ ...prev, apiKey: e.target.value.trim() }))}
                            maxLength={500}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                        {newKeyForm.provider && (
                          <p className="text-xs text-gray-400 mt-1">
                            {newKeyForm.provider === 'openai' && 'OpenAI API keys start with "sk-"'}
                            {newKeyForm.provider === 'anthropic' && 'Anthropic API keys start with "sk-ant-"'}
                            {newKeyForm.provider === 'google_pagespeed' && 'Google API keys typically start with "AIza"'}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          onClick={handleAddApiKey} 
                          disabled={addApiKey.isPending}
                        >
                          {addApiKey.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          {addApiKey.isPending ? "Validating..." : "Add Key"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsAddingKey(false);
                            setNewKeyForm({ provider: '', keyName: '', apiKey: '' });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing API Keys */}
                <div className="space-y-3">
                  {userApiKeys?.map((apiKey: UserApiKey) => (
                    <div key={apiKey.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          {getProviderIcon(apiKey.provider)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{Sanitizer.escapeHtml(apiKey.keyName)}</p>
                          <p className="text-sm text-gray-500">
                            {getProviderName(apiKey.provider)}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">{apiKey.maskedKey}</p>
                          {apiKey.lastValidated && (
                            <p className="text-xs text-gray-400">
                              Last validated: {new Date(apiKey.lastValidated).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(apiKey.validationStatus, apiKey.provider)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleValidateKey(apiKey.id)}
                          disabled={validatingKeys.has(apiKey.id)}
                        >
                          {validatingKeys.has(apiKey.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteApiKey.mutate(apiKey.id)}
                          disabled={deleteApiKey.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {(!userApiKeys || userApiKeys.length === 0) && !isAddingKey && (
                    <div className="text-center py-8 text-gray-500">
                      <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No API keys configured yet.</p>
                      <p className="text-sm">Add your first API key to get started with AI content generation.</p>
                    </div>
                  )}
                </div>

                {/* Provider Status Overview */}
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3">Service Status</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 border rounded">
                      <Bot className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <p className="font-medium">OpenAI</p>
                      {getStatusBadge(
                        apiKeyStatus?.providers?.openai?.configured ? 'valid' : 'invalid',
                        'openai'
                      )}
                    </div>
                    <div className="text-center p-3 border rounded">
                      <Bot className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <p className="font-medium">Anthropic</p>
                      {getStatusBadge(
                        apiKeyStatus?.providers?.anthropic?.configured ? 'valid' : 'invalid',
                        'anthropic'
                      )}
                    </div>
                    <div className="text-center p-3 border rounded">
                      <Globe className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                      <p className="font-medium">PageSpeed</p>
                      {getStatusBadge(
                        apiKeyStatus?.providers?.google_pagespeed?.configured ? 'valid' : 'invalid',
                        'google_pagespeed'
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WordPress Connections</CardTitle>
                <CardDescription>
                  Manage your connected WordPress websites
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {websites?.map((website) => (
                    <div key={website.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{Sanitizer.escapeHtml(website.name)}</p>
                          <p className="text-sm text-gray-500">{website.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={
                          website.status === "active" ? "bg-green-100 text-green-800" :
                          website.status === "processing" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }>
                          {website.status}
                        </Badge>
                        <Button size="sm" variant="outline">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Settings */}
          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="w-5 h-5 mr-2" />
                  Automation Preferences
                </CardTitle>
                <CardDescription>
                  Configure your AI content generation and SEO automation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="defaultAi">Default AI Model</Label>
                  <Select
                    value={settings.automation.defaultAiModel}
                    onValueChange={(value) => updateSetting("automation", "defaultAiModel", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4 (Recommended)</SelectItem>
                      <SelectItem value="claude-3">Claude-3</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini Pro</SelectItem>
                      <SelectItem value="auto-select">Auto-Select Best</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    This will be used as the default for new content generation
                  </p>
                </div>

                <div>
                  <Label htmlFor="frequency">Content Generation Frequency</Label>
                  <Select
                    value={settings.automation.contentGenerationFrequency}
                    onValueChange={(value) => updateSetting("automation", "contentGenerationFrequency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="twice-weekly">Twice Weekly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reports">Report Generation</Label>
                  <Select
                    value={settings.automation.reportGeneration}
                    onValueChange={(value) => updateSetting("automation", "reportGeneration", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoFix">Auto-fix SEO Issues</Label>
                    <p className="text-sm text-gray-500">
                      Automatically apply fixes for common SEO issues
                    </p>
                  </div>
                  <Switch
                    id="autoFix"
                    checked={settings.automation.autoFixSeoIssues}
                    onCheckedChange={(checked) => updateSetting("automation", "autoFixSeoIssues", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage your account security and access controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="twoFactor">Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-500">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Switch
                    id="twoFactor"
                    checked={settings.security.twoFactorAuth}
                    onCheckedChange={(checked) => updateSetting("security", "twoFactorAuth", checked)}
                  />
                </div>

                <div>
                  <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="1"
                    max="168"
                    value={settings.security.sessionTimeout}
                    onChange={(e) => updateSetting("security", "sessionTimeout", parseInt(e.target.value))}
                    onBlur={(e) => {
                      // Ensure value is within bounds on blur
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 1) {
                        updateSetting("security", "sessionTimeout", 1);
                      } else if (value > 168) {
                        updateSetting("security", "sessionTimeout", 168);
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Automatically log out after this many hours of inactivity (1-168 hours)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="apiAccess">API Access</Label>
                    <p className="text-sm text-gray-500">
                      Allow third-party applications to access your data
                    </p>
                  </div>
                  <Switch
                    id="apiAccess"
                    checked={settings.security.allowApiAccess}
                    onCheckedChange={(checked) => updateSetting("security", "allowApiAccess", checked)}
                  />
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium text-gray-900 mb-2">Change Password</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Update your password to keep your account secure. Use a strong password with at least 8 characters.
                  </p>
                  
                  {passwordErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="text-sm text-red-600">
                        <ul className="list-disc list-inside space-y-1">
                          {passwordErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input 
                        id="currentPassword"
                        type="password" 
                        placeholder="Enter your current password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ 
                          ...prev, 
                          currentPassword: e.target.value // Don't sanitize passwords
                        }))}
                        maxLength={200}
                        autoComplete="current-password"
                        className={passwordErrors.some(e => e.includes('current')) ? 'border-red-500' : ''}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input 
                        id="newPassword"
                        type="password" 
                        placeholder="Enter your new password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ 
                          ...prev, 
                          newPassword: e.target.value // Don't sanitize passwords
                        }))}
                        maxLength={200}
                        autoComplete="new-password"
                        className={passwordErrors.some(e => e.includes('new') || e.includes('8 characters')) ? 'border-red-500' : ''}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Must be at least 8 characters. Avoid common passwords.
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input 
                        id="confirmPassword"
                        type="password" 
                        placeholder="Confirm your new password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ 
                          ...prev, 
                          confirmPassword: e.target.value // Don't sanitize passwords
                        }))}
                        maxLength={200}
                        autoComplete="new-password"
                        className={passwordErrors.some(e => e.includes('confirmation') || e.includes('match')) ? 'border-red-500' : ''}
                      />
                    </div>
                    
                    {/* Password strength indicator */}
                    {passwordData.newPassword && (
                      <div className="text-xs">
                        Password strength: 
                        <span className={
                          passwordData.newPassword.length < 8 ? 'text-red-500' :
                          passwordData.newPassword.length < 12 ? 'text-yellow-500' :
                          'text-green-500'
                        }>
                          {passwordData.newPassword.length < 8 ? ' Weak' :
                           passwordData.newPassword.length < 12 ? ' Fair' :
                           ' Strong'}
                        </span>
                      </div>
                    )}
                    
                    <Button 
                      onClick={handlePasswordChange} 
                      disabled={changePassword.isPending}
                      variant="outline" 
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      {changePassword.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
