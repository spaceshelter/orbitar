import moment from 'moment'

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

const plural = (count: number, one: string, few: string, many: string) => {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return one
  }

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return few
  }

  return many
}

const exactMinutesAgo = (minutes: number) => `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')} назад`

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

export function formatRelativeAgeBucket(date: Date) {
  const now = moment()
  const mDate = moment(date)
  const diffMs = Math.max(0, Date.now() - mDate.valueOf())

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

  const totalMonths = Math.max(1, now.diff(mDate, 'months'))

  if (totalMonths < 12) {
    return moreThan(totalMonths, 'месяца', 'месяцев')
  }

  return moreThanYearsAndMonths(Math.floor(totalMonths / 12), totalMonths % 12)
}

export default function DateComponent(props: DateComponentProps) {
  return <>{formatDate(props.date)}</>
}
