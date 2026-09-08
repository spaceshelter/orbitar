import { UserBaseEntity } from '../entities/UserEntity'

export type NotificationsMuteRequest = {
  userId: number
}

export type NotificationsMuteResponse = {
  muted: boolean
}

export type NotificationsUnmuteRequest = {
  userId: number
}

export type NotificationsUnmuteResponse = {
  muted: boolean
}

export type NotificationsMutedRequest = Record<string, never>

export type NotificationsMutedResponse = {
  users: UserBaseEntity[]
}
