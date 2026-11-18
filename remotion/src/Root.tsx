import React from 'react';
import {Composition} from 'remotion';
import {DUR} from './wetsand/T';
import {WetSand} from './wetsand/WetSand';
import {RigSheet, RigTest} from './rig/RigTest';
import {Handy5h} from './motiv/Pilot';
import {DUR_S as MOTIV_DUR} from './motiv/script';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="WetSand" component={WetSand} durationInFrames={Math.round(DUR.en * 60)} fps={60} width={1080} height={1920} defaultProps={{lang: 'en' as const}} />
    <Composition id="WetSandDE" component={WetSand} durationInFrames={Math.round(DUR.de * 60)} fps={60} width={1080} height={1920} defaultProps={{lang: 'de' as const}} />
    <Composition id="RigTest" component={RigTest} durationInFrames={600} fps={60} width={1080} height={1920} />
    <Composition id="RigSheet" component={RigSheet} durationInFrames={1} fps={60} width={1080} height={1920} />
    <Composition id="Handy5h" component={Handy5h} durationInFrames={Math.round(MOTIV_DUR * 60)} fps={60} width={1080} height={1920} defaultProps={{palette: 'farbe' as const}} />
    <Composition id="Handy5hSW" component={Handy5h} durationInFrames={Math.round(MOTIV_DUR * 60)} fps={60} width={1080} height={1920} defaultProps={{palette: 'sw' as const}} />
    <Composition id="Handy5hSWA" component={Handy5h} durationInFrames={Math.round(MOTIV_DUR * 60)} fps={60} width={1080} height={1920} defaultProps={{palette: 'swa' as const}} />
  </>
);
