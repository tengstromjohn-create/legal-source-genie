import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface SourceCardSkeletonProps {
  count?: number;
}

export const SourceCardSkeleton = () => (
  <Card className="h-full">
    <CardHeader>
      <div className="flex items-start gap-3">
        <Skeleton className="h-4 w-4 mt-1" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-9 w-full" />
    </CardContent>
  </Card>
);

export const SourcesListSkeleton = ({ count = 6 }: SourceCardSkeletonProps) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <SourceCardSkeleton key={i} />
    ))}
  </div>
);

export const RequirementCardSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const RequirementsListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="grid gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <RequirementCardSkeleton key={i} />
    ))}
  </div>
);
