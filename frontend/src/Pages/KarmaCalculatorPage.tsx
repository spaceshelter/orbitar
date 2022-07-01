import React, {useEffect} from 'react';
import {Karma} from '../Components/Karma';

export default function KarmaCalculatorPage() {
    useEffect(() => {
        document.title = 'Карма';
    }, []);

    return (
        <div >
            <Karma />
        </div>
    );
}