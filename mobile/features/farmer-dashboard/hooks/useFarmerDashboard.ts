import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import {
  getActivityFeed,
  getFarmerProfile,
  getMilestones,
  getMyAnimals,
  getPendingOutcomes,
  getUnreadNotificationSummary,
  getUpcomingVisits,
} from "../services/farmerDashboard.service";

export const farmerDashboardQueryKeys = {
  profile: ["user", "me"] as const,
  unreadCount: ["notifications", "unreadCount"] as const,
  upcomingVisits: ["visits", "upcoming"] as const,
  pendingOutcomes: ["ai-requests", "pending-outcome"] as const,
  milestones: ["user", "milestones"] as const,
  myAnimals: ["animals", "my"] as const,
  activityFeed: ["user", "activity"] as const,
};

export const useFarmerDashboardQueries = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return {
    queryClient,
    profileQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.profile,
      queryFn: () => getFarmerProfile(api),
    }),
    unreadCountQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.unreadCount,
      queryFn: () => getUnreadNotificationSummary(api),
      refetchInterval: 60000,
    }),
    upcomingVisitsQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.upcomingVisits,
      queryFn: () => getUpcomingVisits(api),
      refetchInterval: 30000,
    }),
    pendingOutcomesQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.pendingOutcomes,
      queryFn: () => getPendingOutcomes(api),
    }),
    milestonesQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.milestones,
      queryFn: () => getMilestones(api),
    }),
    myAnimalsQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.myAnimals,
      queryFn: () => getMyAnimals(api),
    }),
    activityFeedQuery: useQuery({
      queryKey: farmerDashboardQueryKeys.activityFeed,
      queryFn: () => getActivityFeed(api),
    }),
  };
};
