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

export default function DateComponent(props: DateComponentProps) {
    const mDate = moment(props.date);

    const date = mDate.utc(true).calendar({
        sameDay: () => {
            const today = moment().startOf('day');
            if (mDate.isBefore(today)) {
                return '[вчера в] HH:mm';
            }
            return '[сегодня в] HH:mm';
        },
        lastDay: 'D MMMM [в] HH:mm',
        nextDay: '[сегодня в] HH:mm',
        nextWeek: 'DD.MM.YYYY HH:mm',
        lastWeek: 'D MMMM [в] HH:mm',
        sameElse: () => {
            if (mDate.isBefore(startYear)) {
                return 'DD.MM.YYYY HH:mm';
            }
            else {
                return 'D MMMM [в] HH:mm';
            }
        }
    });

    return <>{date}</>;
}
