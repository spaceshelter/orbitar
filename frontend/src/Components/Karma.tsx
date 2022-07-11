import React, {useEffect, useState} from 'react';
import './KarmaCalculator.scss';

type KarmaCalculatorProps = {
    postsSumRating?: number;
    commentsSumRating?: number;
    profileVotesCount?: number;
    profileVotesSum?: number;
};

export function Karma(props: KarmaCalculatorProps) {
    const [allPostsValue, setP] = useState(props.postsSumRating || 0); // sum of votes for all posts
    const [allCommentsValue, setC] = useState(props.commentsSumRating || 0); // sum of votes for all comments
    const [profileVotesCount, setUCount] = useState(props.profileVotesCount || 0); //count of votes in profile
    const [profileVotingResult, setU] = useState(props.profileVotesSum || 0); // sum of votes in profile
    const [punishment, setPunishment] = useState(0); // penalty set by moderator

    useEffect(() => {
         setU( clamp(profileVotingResult, -profileVotesCount * 2, profileVotesCount * 2));
    },[profileVotesCount, profileVotingResult]);

    //TODO extract the rest of coefficients to constants and comment them

    //content quality ratio
    const positiveCommentsDivisor = 10; // positive comments are 10x cheaper than posts
    const negativeCommentsDivisor = 2; // negative comments are only 2x cheaper than posts
    const contentVal = (allPostsValue + allCommentsValue/(allCommentsValue>=0?positiveCommentsDivisor:negativeCommentsDivisor))/5000;
    const contentRating = (contentVal > 0 ? bipolarSigmoid(contentVal/3) : Math.max(-1, -Math.pow(contentVal,2)*7) );

    //user reputation ratio
    const ratio = profileVotingResult / profileVotesCount;
    const s = fit01(profileVotesCount, 10, 200, 0 ,1);
    const userRating = ( profileVotingResult >= 0 ? 1 : Math.max(0, 1 - lerp(Math.pow(ratio/100, 2), Math.pow(ratio*2, 2), s)));

    // karma without punishment
    const rawKarma = Math.ceil(((contentRating+1)*userRating-1) * 1000);

    // karma with punishment
    const karma = Math.max(-1000, rawKarma - punishment);

    return (
        <div id='karmaCalculator'>
            <h1>Калькулятор кармы</h1>
            <h2>Входные данные</h2>
                <label className="slider">Суммарный рейтинг всех постов: {allPostsValue}<br/>
                        <input type="range" min="-2000" max="30000" value={allPostsValue} step="100" onChange={e => setP( +e.target.value) } />
                </label>
                <label className="slider">Суммарный рейтинг всех комментов: {allCommentsValue}<br/>
                        <input type="range" min="-4000" max="30000" value={allCommentsValue} step="100" onChange={e => setC( +e.target.value) } />
                </label>
                <label className="slider">Количество голосов в профиле: {profileVotesCount}<br/>
                        <input type="range" min="0" max="250" value={profileVotesCount.toString()} step="1" onChange={e => setUCount( +e.target.value) } />
                </label>
                <label className="slider">Сумма всех голосов в профиле: {profileVotingResult}<br/>
                        <input type="range" min={-profileVotesCount * 2} max={profileVotesCount * 2} value={profileVotingResult} step="1" onChange={e => setU( +e.target.value) } />
                </label>
                <label className="slider">Кармический штраф наложенный сенатом: {punishment}<br/>
                        <input type="range" min="0" max="2000" value={punishment} step="100" onChange={e => setPunishment( +e.target.value) } />
                </label>

                <div>
                    <h2>-------------------------------------</h2>
                    <h2>Результат</h2>
                    <p> Рейтинг контента: {contentRating}</p>
                    <p> Рейтинг юзера: {userRating}</p>
                    <p> Сырая Карма: {rawKarma}</p>
                    <p> Карма: {karma}</p>
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