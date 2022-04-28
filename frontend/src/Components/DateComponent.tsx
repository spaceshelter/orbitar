import moment from 'moment';
import 'moment/locale/ru';

moment.locale('ru');
moment.updateLocale('ru', {
    months: [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ]
});
const startYear = moment().startOf('year');

interface DateComponentProps {
    date: Date;
}

export default function DateComponent(props: DateComponentProps) {
    const mdate = moment(props.date);

    let date = mdate.utc(true).calendar({
        sameDay: '[сегодня в] HH:mm',
        lastDay: '[вчера в] HH:mm',
        nextDay: 'DD.MM.YYYY HH:mm',
        nextWeek: 'DD.MM.YYYY HH:mm',
        lastWeek: 'DD.MM.YYYY HH:mm',
        sameElse: function (now) {
            if (mdate.isBefore(startYear)) {
                return 'DD.MM.YYYY HH:mm'
            }
            else {
                return 'DD MMMM [в] HH:mm'
            }
        }
    });

    return <>{date}</>
}
