import { UserEntity } from '../entities/UserEntity'

export type AuthSignInRequest = {
  username: string
  password: string
}

export type AuthSignInResponse = {
  user: UserEntity
  session: string
}
