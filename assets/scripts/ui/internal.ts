import { _decorator, AudioClip, AudioSource, Component, resources, sys } from 'cc';

const { ccclass } = _decorator;
const MUTE_KEY = 'pile-up-audio-muted';
type Effect = 'preview' | 'take' | 'place' | 'cap' | 'serve' | 'reject';
const EFFECT_VOLUME: Record<Effect, number> = {
    preview: 0.29, take: 0.34, place: 0.36, cap: 0.34, serve: 0.50, reject: 0.24,
};

@ccclass('KitchenAudio')
export class KitchenAudio extends Component {
    private music!: AudioSource;
    private sfx!: AudioSource;
    private readonly clips = new Map<string, AudioClip>();
    muted = false;

    onLoad(): void {
        try {
            this.muted = sys.localStorage.getItem(MUTE_KEY) === 'yes';
        } catch {
            this.muted = false;
        }
        this.music = this.node.addComponent(AudioSource);
        this.music.playOnAwake = false;
        this.music.loop = true;
        this.music.volume = 0.20;
        this.sfx = this.node.addComponent(AudioSource);
        this.sfx.playOnAwake = false;
        resources.loadDir('audio', AudioClip, (error, clips) => {
            if (!this.isValid) return;
            if (error) {
                console.warn('[KitchenAudio] 音频加载失败', error);
                return;
            }
            for (const clip of clips) this.clips.set(clip.name, clip);
        });
    }

    /** 从实际触控进入，兼容移动端音频解锁。 */
    startFromGesture(): void {
        const clip = this.clips.get('coffee_house_bump');
        if (this.muted || this.music.playing || !clip) return;
        if (!this.music.clip) this.music.clip = clip;
        this.music.play();
    }

    toggleMute(): void {
        this.muted = !this.muted;
        try { sys.localStorage.setItem(MUTE_KEY, this.muted ? 'yes' : 'no'); } catch { /* optional persistence */ }
        if (this.muted) this.music.pause();
        else this.startFromGesture();
    }

    play(effect: Effect): void {
        if (this.muted) return;
        const clip = this.clips.get(effect);
        if (clip) this.sfx.playOneShot(clip, EFFECT_VOLUME[effect]);
    }
}
