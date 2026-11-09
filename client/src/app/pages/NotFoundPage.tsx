import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Home, BookMarked, ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <AppLayout>
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
        {/* Visual 404 Badge */}
        <div className="relative mb-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/10 text-link ring-8 ring-primary/5">
            <BookOpen className="h-12 w-12 stroke-[1.5]" />
          </div>
          <span className="absolute -bottom-2 -right-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-black text-accent-foreground shadow-md">
            404
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Trang không tồn tại
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
          Nội dung bạn đang tìm kiếm có thể đã bị di chuyển, đổi tên hoặc tạm thời không khả dụng trên hệ thống.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </Button>

          <Button asChild className="gap-2 font-semibold">
            <Link to="/">
              <Home className="h-4 w-4" />
              <span>Trang chủ</span>
            </Link>
          </Button>

          <Button asChild variant="secondary" className="gap-2 font-medium">
            <Link to="/library">
              <BookMarked className="h-4 w-4" />
              <span>Tủ sách của tôi</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="gap-2 font-medium">
            <Link to="/stories">
              <Sparkles className="h-4 w-4" />
              <span>Khám phá truyện</span>
            </Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}

export default NotFoundPage
