export enum UserGender {
  fluid,
  he,
  she,
}

export type UserBaseEntity = {
  id: number
  username: string
  gender: UserGender
}

export type UserEntity = UserBaseEntity & {
  karma: number
  name?: string
  vote?: number
  publicKey?: string
  publicKeyAlg?: string
}

export type UserProfileEntity = UserEntity & {
  registered: string
  active: boolean
}
