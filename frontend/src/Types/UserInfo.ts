export enum UserGender {
  fluid,
  he,
  she,
}

export type UserBaseInfo = {
  id: number
  username: string
  gender: UserGender
}

export type UserInfo = UserBaseInfo & {
  name: string
  karma: number
  vote?: number
}

export type UserProfileInfo = UserInfo & {
  registered: Date
  active: boolean
  bio_source: string
  bio_html: string
}

export type BarmaliniAccessResult = {
  login: string
  password: string
}

export type UsernameSuggestResult = {
  usernames: string[]
}

export type UserMarkedContentItem = {
  id: number
  title: string
  url: string
  createdAt: string
  markerType: string
  placedCount: number
  annotation: string | null
}

export type UserMarkedContentResult = {
  items: UserMarkedContentItem[]
  total: number
}
