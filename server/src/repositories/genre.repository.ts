import { Genre, IGenre } from '../models/Genre.model.js'

export const findAll = async (): Promise<IGenre[]> => {
  return Genre.find().sort({ name: 1 })
}

export const findById = async (id: string): Promise<IGenre | null> => {
  return Genre.findById(id)
}

export const findByIds = async (ids: string[]): Promise<IGenre[]> => {
  return Genre.find({ _id: { $in: ids } })
}

export const findBySlug = async (slug: string): Promise<IGenre | null> => {
  return Genre.findOne({ slug })
}

export const findByName = async (name: string): Promise<IGenre | null> => {
  return Genre.findOne({ name })
}

export const create = async (data: Partial<IGenre>): Promise<IGenre> => {
  return Genre.create(data)
}

export const seedDefaultGenresIfEmpty = async (): Promise<void> => {
  const defaultGenres = [
    { name: 'Tiên Hiệp', slug: 'tien-hiep', description: 'Tu tiên, tu đạo, nghịch thiên độ kiếp, phi thăng tiên giới' },
    { name: 'Huyền Huyễn', slug: 'huyen-huyen', description: 'Thế giới phép thuật, dị giới, năng lực thần bí kỳ ảo' },
    { name: 'Kiếm Hiệp', slug: 'kiem-hiep', description: 'Võ lâm giang hồ, ân oán nghĩa hiệp, bí kíp võ công' },
    { name: 'Ngôn Tình', slug: 'ngon-tinh', description: 'Tình cảm lãng mạn, ngọt ngào, cảm xúc sâu lắng' },
    { name: 'Đô Thị', slug: 'do-thi', description: 'Bối cảnh thế giới hiện đại, thương trường, cuộc sống thường nhật' },
    { name: 'Khoa Huyễn', slug: 'khoa-huyen', description: 'Khoa học viễn tưởng, không gian vũ trụ, công nghệ tương lai' },
    { name: 'Hệ Thống', slug: 'he-thong', description: 'Nhân vật chính sở hữu hệ thống hỗ trợ, nhiệm vụ thăng cấp' },
    { name: 'Trọng Sinh', slug: 'trong-sinh', description: 'Sống lại quá khứ, làm lại cuộc đời, chuyển mình thay đổi số phận' },
    { name: 'Dị Năng', slug: 'di-nang', description: 'Siêu năng lực, biến đổi dị thường, thế giới thức tỉnh' },
    { name: 'Mạt Thế', slug: 'mat-the', description: 'Tận thế, thảm họa toàn cầu, zombie, sinh tồn khắc nghiệt' },
    { name: 'Võng Du', slug: 'vong-du', description: 'Thế giới trò chơi thực tế ảo, game online, thăng cấp trang bị' },
    { name: 'Lịch Sử', slug: 'lich-su', description: 'Xuyên không về quá khứ, cung đình, chiến tranh lịch sử quân sự' },
    // Thể loại bổ sung
    { name: 'Hài Hước', slug: 'hai-huoc', description: 'Truyện vui vẻ, hài hước, nhẹ nhàng, giải trí' },
    { name: 'Trinh Thám', slug: 'trinh-tham', description: 'Điều tra tội phạm, giải mã bí ẩn, thám tử' },
    { name: 'Kinh Dị', slug: 'kinh-di', description: 'Rùng rợn, ma quái, nỗi sợ hãi siêu nhiên' },
    { name: 'Thể Thao', slug: 'the-thao', description: 'Bóng đá, bóng rổ, cầu lông, cuộc thi thể thao' },
    { name: 'Quân Sự', slug: 'quan-su', description: 'Chiến tranh, chiến thuật quân sự, anh hùng chiến trường' },
    { name: 'Xuyên Không', slug: 'xuyen-khong', description: 'Du hành thời gian, xuyên không tới thế giới khác' },
    { name: 'Nữ Cường', slug: 'nu-cuong', description: 'Nhân vật nữ mạnh mẽ, độc lập, vươn lên nghịch cảnh' },
    { name: 'Đam Mỹ', slug: 'dam-my', description: 'Tình cảm lãng mạn giữa hai nam nhân vật' },
    { name: 'Bách Hợp', slug: 'bach-hop', description: 'Tình cảm lãng mạn giữa hai nữ nhân vật' },
    { name: 'Phiêu Lưu', slug: 'phieu-luu', description: 'Khám phá thế giới, hành trình mạo hiểm, thế giới rộng lớn' },
  ]

  // Upsert từng thể loại theo slug — thêm mới nếu chưa có, giữ nguyên nếu đã có
  for (const g of defaultGenres) {
    await Genre.updateOne(
      { slug: g.slug },
      { $setOnInsert: g },
      { upsert: true }
    )
  }
}


export const genreRepository = {
  findAll,
  findById,
  findByIds,
  findBySlug,
  findByName,
  create,
  seedDefaultGenresIfEmpty,
}
