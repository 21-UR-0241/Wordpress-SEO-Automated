import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Edit,
  Trash2,
  Globe,
  ShoppingCart,
  Utensils,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import AddWebsiteForm from "@/components/forms/add-website-form";
import { formatDistanceToNow } from "date-fns";

const getWebsiteIcon = (name: string) => {
  if (
    name.toLowerCase().includes("commerce") ||
    name.toLowerCase().includes("store")
  ) {
    return ShoppingCart;
  }
  if (
    name.toLowerCase().includes("restaurant") ||
    name.toLowerCase().includes("food")
  ) {
    return Utensils;
  }
  return Globe;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
          Active
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1.5"></div>
          Processing
        </Badge>
      );
    case "issues":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5"></div>
          Issues
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></div>
          {status}
        </Badge>
      );
  }
};

export default function WebsitesTable() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddWebsiteOpen, setIsAddWebsiteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: websites, isLoading } = useQuery({
    queryKey: ["/api/websites"],
    queryFn: api.getWebsites,
  });

  const deleteWebsite = useMutation({
    mutationFn: api.deleteWebsite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      toast({
        title: "Website Deleted",
        description: "The website has been successfully removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete website. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Managed Websites
          </h3>
        </div>
        <div className="p-6">
          <div className="text-gray-500">Loading websites...</div>
        </div>
      </div>
    );
  }

  const filteredWebsites =
    websites?.filter(
      (website) => statusFilter === "all" || website.status === statusFilter
    ) || [];

  const getSeoScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-medium text-gray-900">
            Managed Websites
          </h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
            <Dialog open={isAddWebsiteOpen} onOpenChange={setIsAddWebsiteOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary-500 hover:bg-primary-600 text-white w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Website
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
                <AddWebsiteForm onSuccess={() => setIsAddWebsiteOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Website
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SEO Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Content
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
            
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredWebsites.map((website) => {
              const Icon = getWebsiteIcon(website.name);
              const seoScoreColor = getSeoScoreColor(website.seoScore);

              return (
                <tr key={website.id}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 sm:w-10 h-8 sm:h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" />
                      </div>
                      <div className="ml-2 sm:ml-4 min-w-0">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                          {website.name}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 truncate">
                          {website.url}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(website.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {website.seoScore}
                      </div>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${seoScoreColor} h-2 rounded-full`}
                          style={{ width: `${website.seoScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {website.contentCount} posts
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(new Date(website.updatedAt), {
                      addSuffix: true,
                    })}
                  </td>
                
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredWebsites.length === 0 && (
          <div className="text-center py-12">
            <Globe className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No websites found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter === "all"
                ? "Get started by adding your first WordPress website."
                : `No websites with status "${statusFilter}" found.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
