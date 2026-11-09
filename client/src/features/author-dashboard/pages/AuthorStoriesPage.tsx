import React, { useState } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  BookOpen,
  BarChart3,
  ChevronRight,
  Camera,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/features/auth/store/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ChangeCoverModal } from "@/features/stories/components/ChangeCoverModal";
import { useAuthorStories } from "@/features/stories/hooks/useAuthorStories";
import { useDeleteStory } from "@/features/stories/hooks/useStoryMutations";
import type { Story } from "@/types/story";

const formatCount = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const AuthorStoriesPage: React.FC = () => {
  const { user } = useAuthStore();
  const { data, isLoading, isError, error, refetch, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAuthorStories({});
  const deleteStoryMutation = useDeleteStory();
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [selectedCoverStory, setSelectedCoverStory] = useState<Story | null>(null);

  const stories = data?.pages.flatMap((page) => page.stories) ?? [];
  const loadError = isAxiosError(error)
    ? error.response?.data?.message || "Không kết nối được máy chủ. Vui lòng thử lại."
    : "Không tải được danh sách truyện. Vui lòng thử lại.";

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteStoryMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-b from-surface-raised/60 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Link to="/" className="hover:text-link transition-colors">
                  Trang chủ
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Truyện của tôi</span>
              </div>
              <h1 className="font-serif text-2xl font-bold flex items-center gap-3 text-foreground">
                <BarChart3 className="h-7 w-7 text-link" />
                Quản lý truyện
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Xin chào{" "}
                <span className="font-medium text-foreground">
                  {user?.displayName}
                </span>
                {isLoading ? ", đang tải danh sách truyện…" : isError
                  ? ", danh sách truyện hiện chưa tải được."
                  : <>, bạn đang có <span className="font-bold text-link">{stories.length}</span> truyện.</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/author/crawl">Nhập nhiều truyện/chương</Link>
            </Button>
            <Button asChild variant="default" className="rounded-full">
              <Link to="/author/stories/new">
                <Plus className="h-4 w-4" />
                Tạo truyện mới
              </Link>
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stories Table */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isError ? (
          <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-6">
            <h2 className="font-semibold text-foreground">Không tải được danh sách truyện</h2>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <p className="text-sm text-muted-foreground">Lỗi tải danh sách không có nghĩa là truyện đã bị xóa.</p>
            <Button onClick={() => void refetch()} isLoading={isFetching}>Thử lại</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-secondary p-6 text-link">
              <BookOpen className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Chưa có truyện nào</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bắt đầu sáng tác truyện đầu tiên của bạn ngay bây giờ!
            </p>
            <Button asChild variant="default" className="mt-6 rounded-full">
              <Link to="/author/stories/new">
                <Plus className="h-4 w-4" />
                Tạo truyện mới
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((story) => {
              const statusLabel =
                story.status === "completed"
                  ? "Hoàn thành"
                  : story.status === "hiatus"
                    ? "Tạm dừng"
                    : "Đang ra";
              const statusVariant =
                story.status === "completed"
                  ? ("success" as const)
                  : ("secondary" as const);

              return (
                <div
                  key={story._id}
                  className="group flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/40 hover:shadow-hover transition-all sm:flex-nowrap sm:items-center sm:gap-4"
                >
                  {/* Cover Thumbnail with Quick Change Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedCoverStory(story)}
                    className="relative h-20 w-14 overflow-hidden rounded-none border border-border bg-surface-raised shrink-0 cursor-pointer group/cover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Đổi ảnh bìa: ${story.title}`}
                    title="Bấm để đổi ảnh bìa"
                  >
                    {story.coverUrl ? (
                      <img
                        src={story.coverUrl}
                        alt={story.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary text-link">
                        <BookOpen className="h-5 w-5" />
                      </div>
                    )}
                    {/* Hover Camera Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                      <Camera className="h-4 w-4" />
                      <span className="text-[9px] font-semibold mt-0.5">Đổi bìa</span>
                    </div>
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/stories/${story.slug}`}>
                      <h3 className="font-serif font-bold text-foreground group-hover:text-link transition-colors line-clamp-1">
                        {story.title}
                      </h3>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={statusVariant} className="text-[10px]">
                        {statusLabel}
                      </Badge>
                      <span className="flex items-center gap-0.5">
                        <BookOpen className="h-3 w-3 text-link" />
                        {story.chapterCount} chương
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {formatCount(story.viewCount)}
                      </span>
                      <span>Cập nhật: {formatDate(story.updatedAt)}</span>
                    </div>
                    <Link
                      to={`/author/stories/${story._id}/crawl`}
                      className="mt-2 inline-flex rounded text-xs font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Nhập từ website (Crawler)
                    </Link>
                    <Link
                      to={`/author/crawl?storyId=${story._id}`}
                      className="mt-2 inline-flex rounded text-xs font-medium text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:ml-3"
                    >
                      Nhập nhiều chương
                    </Link>
                  </div>

                  {/* Actions */}
                  <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mr-auto flex items-center gap-1 rounded-full text-xs text-link sm:mr-0"
                      asChild
                    >
                      <Link to={`/author/stories/${story._id}/chapters`}>
                        <BookOpen className="h-3.5 w-3.5" />
                        Chương ({story.chapterCount})
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:text-link hover:bg-secondary"
                      onClick={() => setSelectedCoverStory(story)}
                      title="Đổi ảnh bìa truyện"
                      aria-label={`Đổi ảnh bìa: ${story.title}`}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                      asChild
                      title="Sửa thông tin truyện"
                      aria-label={`Sửa thông tin: ${story.title}`}
                    >
                      <Link to={`/author/stories/${story._id}/edit`}>
                        <Edit3 className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(story)}
                      title="Xóa truyện"
                      aria-label={`Xóa truyện: ${story.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Đang tải..." : "Tải thêm"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xóa truyện"
        description={`Bạn có chắc chắn muốn xóa "${deleteTarget?.title}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa truyện"
        onConfirm={handleDelete}
        isLoading={deleteStoryMutation.isPending}
      />

      {/* Change Story Cover Modal */}
      <ChangeCoverModal
        story={selectedCoverStory}
        open={!!selectedCoverStory}
        onClose={() => setSelectedCoverStory(null)}
      />
    </AppLayout>
  );
};

export default AuthorStoriesPage;
