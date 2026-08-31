import moment from 'moment'

import { pluralizeWord } from '../Utils/utils'

import 'moment/locale/ru'

moment.locale('ru')
moment.updateLocale('ru', {
  months: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
  relativeTime: {
    future: '%s',
  },
})
const startYear = moment().startOf('year')
const endYear = moment().endOf('year')

const minuteMs = 60 * 1000
const hourMs = 60 * 60 * 1000
const dayMs = 24 * hourMs
const weekMs = 7 * dayMs

interface DateComponentProps {
  date: Date
}

export function formatDate(date: Date) {
  const mDate = moment(date)

  return mDate.calendar({
    sameDay: '[сегодня в] HH:mm',
    lastDay: '[вчера в] HH:mm',
    nextDay: '[завтра в] HH:mm',
    nextWeek: 'D MMMM [в] HH:mm',
    lastWeek: 'D MMMM [в] HH:mm',
    sameElse: () => {
      if (mDate.isBefore(startYear) || mDate.isAfter(endYear)) {
        return 'DD.MM.YYYY HH:mm'
      } else {
        return 'D MMMM [в] HH:mm'
      }
    },
  })
}

const exactMinutesAgo = (minutes: number) => `${minutes} ${pluralizeWord(minutes, ['минуту', 'минуты', 'минут'])} назад`

const moreThan = (count: number, singular: string, pluralName: string) =>
  count === 1 ? `более ${singular} назад` : `более ${count} ${pluralName} назад`

const moreThanYearsAndMonths = (years: number, months: number) => {
  if (years >= 5 || months === 0) {
    return moreThan(years, 'года', 'лет')
  }

  const yearsText = years === 1 ? 'года' : `${years} лет`
  const monthsText = months === 1 ? 'месяца' : `${months} месяцев`

  return `более ${yearsText} и ${monthsText} назад`
}

export function formatRelativeAgeBucket(date: Date, now = Date.now()) {
  const diffMs = Math.max(0, now - date.getTime())

  if (diffMs < hourMs) {
    return exactMinutesAgo(Math.max(1, Math.floor(diffMs / minuteMs)))
  }

  if (diffMs < dayMs) {
    return moreThan(Math.floor(diffMs / hourMs), 'часа', 'часов')
  }

  if (diffMs < weekMs) {
    return moreThan(Math.floor(diffMs / dayMs), 'дня', 'дней')
  }

  if (diffMs < 4 * weekMs) {
    return moreThan(Math.floor(diffMs / weekMs), 'недели', 'недель')
  }

  const totalMonths = Math.max(1, moment(now).diff(date, 'months'))

  if (totalMonths < 12) {
    return moreThan(totalMonths, 'месяца', 'месяцев')
  }

  return moreThanYearsAndMonths(Math.floor(totalMonths / 12), totalMonths % 12)
}

export default function DateComponent(props: DateComponentProps) {
  return <>{formatDate(props.date)}</>
}
