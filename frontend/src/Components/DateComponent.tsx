interface DateComponentProps {
    date: Date;
}

export default function DateComponent(props: DateComponentProps) {
    return <>{props.date.toLocaleString('ru-RU')}</>
}
