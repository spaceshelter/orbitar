import moment from 'moment';
import 'moment/locale/ru';

moment.locale('ru');
moment.updateLocale('ru', {
    months: [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ],
    relativeTime : {
        future: '%s'
    }
});
const startYear = moment().startOf('year');

interface DateComponentProps {
    date: Date;
}

export function formatDate(date: Date) {
    const mDate = moment(date);

    return mDate.calendar({
        sameDay: '[сегодня в] HH:mm',
        lastDay: '[вчера в] HH:mm',
        nextDay: '[сегодня в] HH:mm',
        nextWeek: 'DD.MM.YYYY HH:mm',
        lastWeek: 'D MMMM [в] HH:mm',
        sameElse: () => {
            if (mDate.isBefore(startYear)) {
                return 'DD.MM.YYYY HH:mm';
            } else {
                return 'D MMMM [в] HH:mm';
            }
        }
    });
}

export default function DateComponent(props: DateComponentProps) {
    return <>{formatDate(props.date)}</>;
}