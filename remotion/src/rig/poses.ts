import {P_, Pose} from './Guy';

// Key poses for the code character (facing right). Angles: 0 = arm hanging down, 90 = forward, 180 = up.
export const POSES: Record<string, Pose> = {
  idle: P_({armB: [10, 8], armF: [-8, 12]}),
  holdJar: P_({armB: [12, 104], armF: [-14, 112], look: [0.2, 0.1]}),
  pour: P_({lean: 7, armB: [58, 46], armF: [48, 52], look: [0.7, 0.8], mouth: 'tongue', brow: 0.5, browUp: 0.2}),
  wave: P_({armB: [8, 8], armF: [122, 34], eyes: 'happy', mouth: 'open', head: 5, look: [0.2, -0.1]}),
  surprised: P_({bodyY: -30, armB: [-128, -26], armF: [128, 26], footB: [-14, -18], footF: [20, -22], eyes: 'wide', mouth: 'o', browUp: 1, look: [0, -0.1]}),
  shrug: P_({armB: [-44, -80], armF: [44, 80], head: -7, eyes: 'open', mouth: 'wavy', brow: 1, browUp: 0.4, look: [0.3, -0.3]}),
  strain: P_({lean: 26, bodyY: 20, armB: [44, 104], armF: [52, 98], handB: 'fist', handF: 'fist', footB: [-74, 0], footF: [46, 0], eyes: 'squeeze', mouth: 'grit', brow: -1}),
  happy: P_({armB: [18, 24], armF: [-10, 34], eyes: 'happy', mouth: 'open', head: 4}),
  think: P_({armB: [10, 8], armF: [26, 150], handF: 'fist', head: 8, eyes: 'open', look: [-0.4, -0.8], mouth: 'flat', brow: 0.3, browUp: 0.6}),
};

/** walk cycle on the spot: phase in turns */
export const walkPose = (phase: number, base: Pose): Pose => {
  const a = phase * Math.PI * 2;
  const lift = (s: number) => -16 * Math.max(0, s);
  return {
    ...base,
    bodyY: -5 * Math.abs(Math.sin(a)),
    lean: 5,
    footB: [-22 * Math.cos(a), lift(Math.sin(a))],
    footF: [22 * Math.cos(a), lift(-Math.sin(a))],
    armB: [22 * Math.cos(a), 14],
    armF: [-22 * Math.cos(a), 18],
  };
};
