import { invoke } from '@tauri-apps/api/core'

export interface InsertionImage {
  name: string
  path: string
  byteLength: number
}

export interface InsertionImageList {
  directory: string
  images: InsertionImage[]
  warnings: string[]
}

export function listInsertionImages(): Promise<InsertionImageList> {
  return invoke<InsertionImageList>('list_insertion_images')
}

export function openInsertionImageFolder(): Promise<string> {
  return invoke<string>('open_insertion_image_folder')
}

export function insertionImageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
