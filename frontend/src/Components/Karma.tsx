import React, {useEffect, useState} from 'react';
import './KarmaCalculator.scss';

type KarmaCalculatorProps = {
    senatePenalty?: number;
    contentSumRating?: number;
    profileVotesCount?: number;
    profileVotesSum?: number;
};

export function Karma(props: KarmaCalculatorProps) {
    const [allContentSum, setAllContentSum] = useState(props.contentSumRating || 0); // sum of votes for all comments
    const [profileVotesCount, setProfileVotesCount] = useState(props.profileVotesCount || 0); //count of votes in profile
    const [profileVotesSum, setProfileVotesSum] = useState(props.profileVotesSum || 0); // sum of votes in profile
    const [punishment, setPunishment] = useState(props.senatePenalty || 0); // penalty set by moderator

    useEffect(() => {
         setProfileVotesSum( clamp(profileVotesSum, -profileVotesCount * 2, profileVotesCount * 2));
    },[profileVotesCount, profileVotesSum]);

    //TODO extract the rest of coefficients to constants and comment them

    //content quality ratio
    const negativeContentMultiplier = 5; // negative content rating is 5 times more influential than positive
    const contentVal = (allContentSum * (allContentSum >= 0 ? 1 : negativeContentMultiplier)) / 500;
    const contentRating = (contentVal > 0 ? bipolarSigmoid(contentVal/3) : Math.max(-1, -Math.pow(contentVal,2)*7) );

    //user reputation ratio
    const ratio = profileVotesSum / profileVotesCount;
    const s = fit01(profileVotesCount, 10, 200, 0 ,1);
    const userRating = ( profileVotesSum >= 0 ? 1 : Math.max(0, 1 - lerp(Math.pow(ratio/100, 2), Math.pow(ratio*2, 2), s)));

    console.log(contentRating, userRating, punishment);
    // karma without punishment
    const rawKarma = Math.round(((contentRating + 1) * userRating - 1) * 1000 * 100) / 100;

    // karma with punishment
    const karma = Math.max(-1000, rawKarma - punishment);

    return (
        <div id='karmaCalculator'>
            <h1>Калькулятор</h1>
            <h2>Входные данные</h2>
                <label className="slider">Нормализованный рейтинг контента: {Math.round(allContentSum)}<br/>
                        <input type="range" min="-500" max="500" value={allContentSum} step="2" onChange={e => setAllContentSum( +e.target.value) } />
                    <div>
                        Суммы голосов за контент от каждого уникального пользователя
                        нелинейно приводятся к диапазону значений от -2 до 2 (как у голосов в карму)
                        и затем еще раз суммируются.
                    </div>
                </label>
                <label className="slider">Количество голосов в профиле: {profileVotesCount}<br/>
                        <input type="range" min="0" max="250" value={profileVotesCount.toString()} step="1" onChange={e => setProfileVotesCount( +e.target.value) } />
                </label>
                <label className="slider">Сумма всех голосов в профиле: {profileVotesSum}<br/>
                        <input type="range" min={-profileVotesCount * 2} max={profileVotesCount * 2} value={profileVotesSum} step="1" onChange={e => setProfileVotesSum( +e.target.value) } />
                </label>
                <label className="slider">Кармический штраф, наложенный сенатом: {punishment}<br/>
                        <input type="range" min="0" max="2000" value={punishment} step="100" onChange={e => setPunishment( +e.target.value) } />
                </label>

                <div>
                    <h2>-------------------------------------</h2>
                    <h2>Формула саморегуляции:</h2>
                    <p> Рейтинг контента: {contentRating?.toFixed(2)}</p>
                    <p> Рейтинг юзера: {userRating?.toFixed(2)}</p>
                    <p> Сырой результат: {rawKarma?.toFixed(2)}</p>
                    <p> Результат: {karma?.toFixed(2)}</p>
                </div>
        </div>
    );
}

const fit01 = (current: number, in_min: number, in_max: number, out_min: number, out_max: number): number =>{
    const mapped: number = ((current - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
    return clamp(mapped, out_min, out_max);
};
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const lerp = (start: number, end: number, r: number): number => (1-r)*start + r*end;
const bipolarSigmoid = (n: number): number => n/Math.sqrt(1+n*n);