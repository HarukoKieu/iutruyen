import React from 'react'
import { Link } from 'react-router-dom'
import { Heart, Feather, Mail } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { ROUTES } from '@/constants/routes'



export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-surface-raised/60 mt-20 transition-colors">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand & Manifesto Column */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo size="md" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              Không gian đọc truyện chữ miễn phí, nhẹ nhàng và hiện đại. Nơi tôn vinh tác giả độc lập và kết nối cộng đồng người yêu chữ Việt.
            </p>
            <a
              href="mailto:contact@iutruyen.com"
              className="inline-flex max-w-full items-center gap-2 text-sm text-muted-foreground hover:text-link transition-colors"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-all">Liên hệ: contact@iutruyen.com</span>
            </a>
            <p className="pt-2 text-xs text-muted-foreground">Đọc truyện công khai miễn phí, không cần tài khoản.</p>
          </div>

          {/* Quick Discover Links */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
              Khám Phá
            </h2>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/stories?sort=hot" className="hover:text-link transition-colors">
                  Truyện Thịnh Hành
                </Link>
              </li>
              <li>
                <Link to="/stories?sort=new" className="hover:text-link transition-colors">
                  Mới Cập Nhật
                </Link>
              </li>
              <li>
                <Link to="/stories?status=completed" className="hover:text-link transition-colors">
                  Tác Phẩm Hoàn Thành (Full)
                </Link>
              </li>
              <li>
                <Link to="/ranking" className="hover:text-link transition-colors">
                  Bảng Xếp Hạng
                </Link>
              </li>
              <li>
                <Link to="/stories?sort=rating" className="hover:text-link transition-colors">
                  Đánh Giá Cao Nhất
                </Link>
              </li>
            </ul>
          </div>

          {/* Literary Spaces */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
              Không Gian Tác Giả
            </h2>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to={ROUTES.AUTHOR_APPLY} className="hover:text-link transition-colors">
                  Đăng ký làm tác giả
                </Link>
              </li>
              <li>
                <Link to="/author/stories/new" className="hover:text-link transition-colors flex items-center gap-1">
                  <Feather className="h-3 w-3" />
                  Đăng Tác Phẩm Mới
                </Link>
              </li>
              <li>
                <Link to="/author/stories" className="hover:text-link transition-colors">
                  Bảng Điều Khiển Tác Giả
                </Link>
              </li>
              <li>
                <span>Hợp Đồng Bản Quyền Số — đang chuẩn bị</span>
              </li>
            </ul>
          </div>

          {/* Support & Policies */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground font-sans">
              Quy Định & Pháp Lý
            </h2>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <span>
                  Điều Khoản Dịch Vụ
                </span>
              </li>
              <li>
                <span>
                  Chính Sách Bảo Mật
                </span>
              </li>
              <li>
                <span>
                  Quy Định Kiểm Duyệt 18+
                </span>
              </li>
              <li>
                <span>
                  Báo Cáo Vi Phạm (DMCA)
                </span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">Các trang quy định đang được chuẩn bị.</p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} iutruyen. Bản quyền nội dung thuộc về các tác giả.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-[11px]">
              Được tạo ra với <Heart className="h-3 w-3 text-destructive fill-destructive inline mx-0.5" /> cho độc giả Việt
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
