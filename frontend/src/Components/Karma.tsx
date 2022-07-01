import React, {useEffect, useState} from 'react';
import './KarmaCalculator.scss';
export function Karma() {
    const [allPostsValue, setP] = useState(0); // sum of votes for all posts
    const [allCommentsValue, setC] = useState(0); // sum of votes for all comments
    const [profileVotesCount, setUCount] = useState(0); //count of votes in profile
    const [profileVotingResult, setU] = useState(0); // sum of votes in profile
    const [punishment, setPunishment] = useState(0); // penalty set by moderator

    const [contentRating, setContentRating] = useState(0); // content quality ratio
    const [userRating, setUserRating] = useState(0); //user reputation ratio
    const [rawKarma, setRawKarma] = useState(0); // karma without punishment
    const [karma, setKarma] = useState(0);// karma with punishment

    const positiveCommentsDivisor = 10; // positive comments are 10x cheaper than posts
    const negativeCommentsDivisor = 2; // negative comments are only 2x cheaper than posts
    //TODO extract the rest of coefficients to constants and comment them

    useEffect(() => {
        setU( clamp(profileVotingResult, -profileVotesCount, profileVotesCount));
    },[profileVotesCount]);

    useEffect(() => {
        const x = (allPostsValue + allCommentsValue/(allCommentsValue>=0?positiveCommentsDivisor:negativeCommentsDivisor))/5000;
        setContentRating(x > 0 ? bipolarSigmoid(x/3) : Math.max(-1, -x*x*7) );
    },[allPostsValue, allCommentsValue]);

    useEffect(() => {
        const x = profileVotingResult / profileVotesCount;
        const ratio =  fit01(profileVotesCount, 10, 200, 0 ,1);
        setUserRating( profileVotingResult >= 0 ? 1 : Math.max(0, 1 - lerp(Math.pow(x/100, 2), Math.pow(x*2, 2), ratio)));
    },[profileVotingResult, profileVotesCount]);

    useEffect(() => {
        const k = Math.ceil(((contentRating+1)*userRating-1) *1000);
        setRawKarma(k);
        setKarma( Math.max(-1000, k - punishment) );
    },[contentRating, userRating, punishment]);

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
                        <input type="range" min={-profileVotesCount} max={profileVotesCount} value={profileVotingResult} step="1" onChange={e => setU( +e.target.value) } />
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