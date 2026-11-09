import type { ClientSession, Document, Model } from 'mongoose'
import { Story } from '../models/Story.model.js'
import { Chapter } from '../models/Chapter.model.js'
import { Comment } from '../models/Comment.model.js'
import { resourceId } from '../common/contentVisibility.js'

/** Writers and counters share the transaction; parent writes serialize concurrent changes. */
export async function recountChapterCount(storyId: unknown, session: ClientSession) {
  const id = resourceId(storyId)
  await Story.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session })
  const chapterCount = await Chapter.countDocuments({ storyId: id, status: 'published', moderationStatus: 'approved' }).session(session)
  await Story.updateOne({ _id: id }, { $set: { chapterCount } }, { session })
}

/** Count only visible, non-deleted replies; repeated deletes cannot decrement twice. */
export async function recountReplyCount(parentId: unknown, session: ClientSession) {
  const id = resourceId(parentId)
  if (!id) return
  await Comment.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session })
  const replyCount = await Comment.countDocuments({ parentId: id, isDeleted: false, isHidden: { $ne: true } }).session(session)
  await Comment.updateOne({ _id: id }, { $set: { replyCount } }, { session })
}

export async function syncModeratedCounters(document: Document, session: ClientSession) {
  const name = (document.constructor as Model<Document>).modelName
  if (name === 'Chapter') await recountChapterCount(document.get('storyId'), session)
  if (name === 'Comment' && document.get('parentId')) await recountReplyCount(document.get('parentId'), session)
}
