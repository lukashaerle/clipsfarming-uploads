import React from 'react';
import {Composition} from 'remotion';
import {DUR} from './wetsand/T';
import {WetSand} from './wetsand/WetSand';
import {RigSheet, RigTest} from './rig/RigTest';
import {Handy5h} from './motiv/Pilot';
import {DUR_S as MOTIV_DUR} from './motiv/script';
import {BrandBanner, BrandCover, BrandProfile, BrandWordmark} from './brand/Brand';
import {LrVideo, lrMetadata} from './lr/Video';
import type {LrProps} from './lr/spec';

const LR_DEFAULT: LrProps = {
  spec: {id: 'leer', title: 'leer', scenes: [{vo: '', head: '*Lebens*|rechnung', graphic: {kind: 'none'}}]},
  timeline: {length: 3, scenes: [{start: 0, end: 3}], audio: ''},
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="WetSand" component={WetSand} durationInFrames={Math.round(DUR.en * 60)} fps={60} width={1080} height={1920} defaultProps={{lang: 'en' as const}} />
    <Composition id="WetSandDE" component={WetSand} durationInFrames={Math.round(DUR.de * 60)} fps={60} width={1080} height={1920} defaultProps={{lang: 'de' as const}} />
    <Composition id="RigTest" component={RigTest} durationInFrames={600} fps={60} width={1080} height={1920} />
    <Composition id="RigSheet" component={RigSheet} durationInFrames={1} fps={60} width={1080} height={1920} />
    <Composition id="Handy5h" component={Handy5h} durationInFrames={Math.round(MOTIV_DUR * 60)} fps={60} width={1080} height={1920} defaultProps={{palette: 'farbe' as const}} />
    <Composition id="Handy5hSW" component={Handy5h} durationInFrames={Math.round(MOTIV_DUR * 60)} fps={60} width={1080} height={1920} defaultProps={{palette: 'sw' as const}} />
    <Composition id="Handy5hSWA" component={Handy5h} durationInFrames={Math.round(MOTIV_DUR * 60)} fps={60} width={1080} height={1920} defaultProps={{palette: 'swa' as const}} />
    <Composition id="BrandProfile" component={BrandProfile} durationInFrames={1} fps={60} width={1080} height={1080} defaultProps={{first: 'Zeit', second: 'rechnung', tagline: 'Dein Leben in Zahlen'}} />
    <Composition id="BrandBanner" component={BrandBanner} durationInFrames={1} fps={60} width={2560} height={1440} defaultProps={{first: 'Zeit', second: 'rechnung', tagline: 'Dein Leben in Zahlen'}} />
    <Composition id="BrandCover" component={BrandCover} durationInFrames={1} fps={60} width={1080} height={1920} defaultProps={{first: 'Zeit', second: 'rechnung', tagline: 'Dein Leben in Zahlen', title1: '5 Stunden', title2: 'am Handy', number: '76', unit: 'Tage im Jahr'}} />
    <Composition id="BrandWordmark" component={BrandWordmark} durationInFrames={1} fps={60} width={1600} height={500} defaultProps={{first: 'Zeit', second: 'rechnung', tagline: 'Dein Leben in Zahlen'}} />
    <Composition id="LR" component={LrVideo} durationInFrames={180} fps={60} width={1080} height={1920} defaultProps={LR_DEFAULT} calculateMetadata={lrMetadata} />
  </>
);
