import React, { useEffect, useState } from 'react'

import './KarmaCalculator.scss'

// --- Karma formula constants ---
// These must match the backend formula in UserManager.ts

// Content quality scoring
const NEGATIVE_CONTENT_MULTIPLIER = 5 // negative content rating is N times more influential than positive
const CONTENT_RATING_NORMALIZER = 500 // normalizes raw content vote sum to working range
const CONTENT_SIGMOID_COMPRESSION = 3 // controls how quickly positive content rating saturates via sigmoid
const CONTENT_NEGATIVE_AMPLIFIER = 7 // amplifies squared negative content values for steeper penalty curve
const CONTENT_RATING_FLOOR = -1 // minimum possible content rating

// User reputation scoring
const REPUTATION_RATIO_NORMALIZER = 100 // scales vote ratio to comparable range
const REPUTATION_RATIO_AMPLIFIER = 2 // amplifies ratio for lerp endpoint (steeper penalty for bad reputation)
const MIN_VOTES_FOR_CONFIDENCE = 10 // minimum profile votes before reputation has weight
const FULL_CONFIDENCE_VOTE_COUNT = 200 // profile vote count at which reputation signal is fully trusted
const MAX_PROFILE_VOTE_VALUE = 2 // maximum absolute value of a single profile vote

// Karma scaling
const KARMA_SCALE = 1000 // maps normalized [-1, 1] range to display karma range
const MIN_KARMA = -1000 // absolute minimum karma (floor)

type KarmaCalculatorProps = {
  senatePenalty?: number
  contentSumRating?: number
  profileVotesCount?: number
  profileVotesSum?: number
}

export function Karma(props: KarmaCalculatorProps) {
  const [allContentSum, setAllContentSum] = useState(props.contentSumRating || 0) // sum of votes for all comments
  const [profileVotesCount, setProfileVotesCount] = useState(props.profileVotesCount || 0) //count of votes in profile
  const [profileVotesSum, setProfileVotesSum] = useState(props.profileVotesSum || 0) // sum of votes in profile
  const [punishment, setPunishment] = useState(props.senatePenalty || 0) // penalty set by moderator

  useEffect(() => {
    setProfileVotesSum(
      clamp(profileVotesSum, -profileVotesCount * MAX_PROFILE_VOTE_VALUE, profileVotesCount * MAX_PROFILE_VOTE_VALUE),
    )
  }, [profileVotesCount, profileVotesSum])

  //content quality ratio
  const contentVal =
    (allContentSum * (allContentSum >= 0 ? 1 : NEGATIVE_CONTENT_MULTIPLIER)) / CONTENT_RATING_NORMALIZER
  const contentRating =
    contentVal > 0
      ? bipolarSigmoid(contentVal / CONTENT_SIGMOID_COMPRESSION)
      : Math.max(CONTENT_RATING_FLOOR, -Math.pow(contentVal, 2) * CONTENT_NEGATIVE_AMPLIFIER)

  //user reputation ratio
  const ratio = profileVotesSum / profileVotesCount
  const s = fit01(profileVotesCount, MIN_VOTES_FOR_CONFIDENCE, FULL_CONFIDENCE_VOTE_COUNT, 0, 1)
  const userRating =
    profileVotesSum >= 0
      ? 1
      : Math.max(
          0,
          1 -
            lerp(Math.pow(ratio / REPUTATION_RATIO_NORMALIZER, 2), Math.pow(ratio * REPUTATION_RATIO_AMPLIFIER, 2), s),
        )

  console.log(contentRating, userRating, punishment)
  // karma without punishment
  const rawKarma = Math.round(((contentRating + 1) * userRating - 1) * KARMA_SCALE * 100) / 100

  // karma with punishment
  const karma = Math.max(MIN_KARMA, rawKarma - punishment)

  return (
    <div id='karmaCalculator'>
      <h1>Калькулятор</h1>
      <h2>Входные данные</h2>
      <label className='slider'>
        Нормализованный рейтинг контента: {Math.round(allContentSum)}
        <br />
        <input
          type='range'
          min='-500'
          max='500'
          value={allContentSum}
          step='2'
          onChange={(e) => setAllContentSum(+e.target.value)}
        />
        <div>
          Суммы голосов за контент от каждого уникального пользователя нелинейно приводятся к диапазону значений от -2
          до 2 (как у голосов в карму) и затем еще раз суммируются.
        </div>
      </label>
      <label className='slider'>
        Количество голосов в профиле: {profileVotesCount}
        <br />
        <input
          type='range'
          min='0'
          max='250'
          value={profileVotesCount.toString()}
          step='1'
          onChange={(e) => setProfileVotesCount(+e.target.value)}
        />
      </label>
      <label className='slider'>
        Сумма всех голосов в профиле: {profileVotesSum}
        <br />
        <input
          type='range'
          min={-profileVotesCount * MAX_PROFILE_VOTE_VALUE}
          max={profileVotesCount * MAX_PROFILE_VOTE_VALUE}
          value={profileVotesSum}
          step='1'
          onChange={(e) => setProfileVotesSum(+e.target.value)}
        />
      </label>
      <label className='slider'>
        Кармический штраф, наложенный сенатом: {punishment}
        <br />
        <input
          type='range'
          min='0'
          max='2000'
          value={punishment}
          step='100'
          onChange={(e) => setPunishment(+e.target.value)}
        />
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
  )
}

const fit01 = (current: number, in_min: number, in_max: number, out_min: number, out_max: number): number => {
  const mapped: number = ((current - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
  return clamp(mapped, out_min, out_max)
}
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n))
const lerp = (start: number, end: number, r: number): number => (1 - r) * start + r * end
const bipolarSigmoid = (n: number): number => n / Math.sqrt(1 + n * n)
