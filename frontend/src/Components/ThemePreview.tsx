import React from 'react';
import './ThemePreview.scss';
export function ThemePreview (){
    return (
        <div id='themePreview'>

            <div className='section'>
                    <div className="label">Foregrounds</div>
                    <div className='row'><div className='fgHardest bgr sample'></div><div className='clr fgHardest'>fgHardest</div></div>
                    <div className='row'><div className='fgHarder bgr sample'></div><div className='clr fgHarder'>fgHarder</div></div>
                    <div className='row'><div className='fgHard bgr sample'></div><div className='clr fgHard'>fgHard</div></div>
                    <hr/>
                    <div className='row'><div className='fg bgr sample'></div><div className='clr fg'>fg</div></div>
                    <hr/>
                    <div className='row'><div className='fgMedium bgr sample'></div><div className='clr fgMedium'>fgMedium</div></div>
                    <div className='row'><div className='fgSoft bgr sample'></div><div className='clr fgSoft'>fgSoft</div></div>
                    <div className='row'><div className='fgSofter bgr sample'></div><div className='clr fgSofter'>fgSofter</div></div>
                    <div className='row'><div className='fgSoftest bgr sample'></div><div className='clr fgSoftest'>fgSoftest</div></div>
                    <div className='row'><div className='fgGhost bgr sample'></div><div className='clr fgGhost'>fgGhost</div></div>
                    <div className='row'><div className='fgAlmostInvisible bgr sample'></div><div className='clr fgAlmostInvisible'>fgAlmostInvisible</div></div>
            </div>
            <div className='section'>
                    <div className="label">Accents</div>
                    <div className='row'><div className='primary bgr sample'></div><div className='primary clr'>primary</div></div>
                    <div className='row'><div className='primaryHover bgr sample'></div><div className='primaryHover clr'>primaryHover</div></div>
                    <div className='row'><div className='primaryGhost bgr sample'></div><div className='primaryGhost clr'>primaryGhost</div></div>
                    <hr/>
                    <div className='row'><div className='danger bgr sample'></div><div className='danger clr'>danger</div></div>
                    <div className='row'><div className='dangerHover bgr sample'></div><div className='dangerHover clr'>dangerHover</div></div>
                    <div className='row'><div className='dangerGhost bgr sample'></div><div className='dangerGhost clr'>dangerGhost</div></div>
                    <hr/>
                    <div className='row'><div className='positive bgr sample'></div><div className='positive clr'>positive</div></div>
                    <div className='row'><div className='positiveHover bgr sample'></div><div className='positiveHover clr'>positiveHover</div></div>
                    <div className='row'><div className='positiveGhost bgr sample'></div><div className='positiveGhost clr'>positiveGhost</div></div>
                    <hr/>
                    <div className='row'><div className='link bgr sample'></div><div className='link clr'>link</div></div>
                    <div className='row'><div className='linkVisited bgr sample'></div><div className='linkVisited clr'>linkVisited</div></div>
                    <div className='row'><div className='linkHover bgr sample'></div><div className='linkHover clr'>linkHover</div></div>
                    <div className='row'><div className='linkGhost bgr sample'></div><div className='linkGhost clr'>linkGhost</div></div>
            </div>
            <div className='section'>
                    <div className="label">Backgrounds</div>
                    <div className='box elevated'>
                            <div className='label'>elevated</div>
                            <div className='dimDemo'>
                                    <div className='dim1'>dim1</div>
                                    <div className='dim2'>dim2</div>
                                    <div className='dim3'>dim3</div>
                            </div>
                    </div>
                    <div className='box normal'>
                            <div className='label'>bg</div>
                            <div className='dimDemo'>
                                    <div className='dim1'>dim1</div>
                                    <div className='dim2'>dim2</div>
                                    <div className='dim3'>dim3</div>
                            </div>
                    </div>
                    <div className='box lowered'>
                            <div className='label'>lowered</div>
                            <div className='dimDemo'>
                                    <div className='dim1'>dim1</div>
                                    <div className='dim2'>dim2</div>
                                    <div className='dim3'>dim3</div>
                            </div>
                    </div>

            </div>
        </div>
    )
}
