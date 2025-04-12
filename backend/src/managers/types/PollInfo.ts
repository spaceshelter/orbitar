import { PollEntity } from '../../api/types/entities/PollEntity'

export interface PollInfo extends PollEntity {
  created: Date
  [key: `opt${number}`]: number
}
