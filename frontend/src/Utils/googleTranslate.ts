export default async function googleTranslate(str: string | undefined) {
    if(!str) {
        return '';
    }
    const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&dt=bd&dj=1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({q: str})

    });
    const json = await response.json();
    const sentences = (json.sentences as Array<{trans: string}>).map(sentence => sentence.trans);
    return sentences.join('');
}