/**
 * Real WebRTC Audio & Video Communication Service for DARNA Voice & Video Calls
 * Handles peer connection, microphone/camera capture, STUN negotiation, camera toggle, and audio/video playback
 */

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

class WebRTCCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private onRemoteTrackCallback: ((stream: MediaStream) => void) | null = null;
  private onLocalTrackCallback: ((stream: MediaStream) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.remoteAudioElement = document.createElement('audio');
      this.remoteAudioElement.autoplay = true;
      (this.remoteAudioElement as any).playsInline = true;
      this.remoteAudioElement.style.display = 'none';
      document.body.appendChild(this.remoteAudioElement);
    }
  }

  public setOnRemoteStream(cb: (stream: MediaStream) => void) {
    this.onRemoteTrackCallback = cb;
    if (this.remoteStream && cb) {
      cb(this.remoteStream);
    }
  }

  public setOnLocalStream(cb: (stream: MediaStream) => void) {
    this.onLocalTrackCallback = cb;
    if (this.localStream && cb) {
      cb(this.localStream);
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Check if camera device is available on user hardware
  public async isCameraAvailable(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some((device) => device.kind === 'videoinput');
      }
    } catch (e) {
      console.warn('[WebRTC] Error enumerating video devices:', e);
    }
    return false;
  }

  // Get local microphone audio stream with noise suppression & echo cancellation
  private async getLocalAudioStream(): Promise<MediaStream | null> {
    if (this.localStream && this.localStream.getAudioTracks().length > 0) {
      return this.localStream;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        if (!this.localStream) {
          this.localStream = stream;
        } else {
          stream.getAudioTracks().forEach((t) => this.localStream?.addTrack(t));
        }
        return this.localStream;
      }
    } catch (err) {
      console.warn('[WebRTC] Microphone permission denied or not available:', err);
    }
    return null;
  }

  // Toggle local camera (video track) on / off during active call
  public async toggleCamera(enable: boolean): Promise<boolean> {
    try {
      if (enable) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          return false;
        }

        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return false;

        if (!this.localStream) {
          this.localStream = new MediaStream();
        }

        // Stop and remove previous video tracks if any
        this.localStream.getVideoTracks().forEach((t) => {
          t.stop();
          this.localStream?.removeTrack(t);
        });

        this.localStream.addTrack(videoTrack);

        // Add or replace video track in peerConnection if active
        if (this.peerConnection) {
          const videoSender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
          } else {
            this.peerConnection.addTrack(videoTrack, this.localStream);
          }
        }

        if (this.onLocalTrackCallback && this.localStream) {
          this.onLocalTrackCallback(this.localStream);
        }
        return true;
      } else {
        // Turn off camera
        if (this.localStream) {
          this.localStream.getVideoTracks().forEach((t) => {
            t.enabled = false;
            t.stop();
            this.localStream?.removeTrack(t);
          });
        }
        if (this.peerConnection) {
          const videoSender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
          if (videoSender) {
            try {
              this.peerConnection.removeTrack(videoSender);
            } catch (e) {}
          }
        }
        if (this.onLocalTrackCallback && this.localStream) {
          this.onLocalTrackCallback(this.localStream);
        }
        return false;
      }
    } catch (err) {
      console.warn('[WebRTC] Camera toggle error:', err);
      return false;
    }
  }

  // Initialize RTCPeerConnection
  private initPeerConnection(onCandidate: (candidate: RTCIceCandidate) => void): RTCPeerConnection {
    if (this.peerConnection) {
      this.cleanup();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onCandidate(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      let rStream = event.streams && event.streams[0];
      if (!rStream && event.track) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        rStream = this.remoteStream;
      } else if (rStream) {
        this.remoteStream = rStream;
      }

      if (this.remoteStream && this.remoteAudioElement) {
        this.remoteAudioElement.srcObject = this.remoteStream;
        this.remoteAudioElement.autoplay = true;
        (this.remoteAudioElement as any).playsInline = true;
        this.remoteAudioElement.volume = 1.0;
        const playPromise = this.remoteAudioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[WebRTC] Audio autoPlay blocked, retrying on user touch:', err);
            const resumeAudio = () => {
              this.remoteAudioElement?.play().catch(() => {});
              window.removeEventListener('click', resumeAudio);
              window.removeEventListener('touchstart', resumeAudio);
            };
            window.addEventListener('click', resumeAudio, { once: true });
            window.addEventListener('touchstart', resumeAudio, { once: true });
          });
        }
      }

      if (this.onRemoteTrackCallback && this.remoteStream) {
        this.onRemoteTrackCallback(this.remoteStream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    this.peerConnection = pc;
    return pc;
  }

  // Caller creates WebRTC Offer
  public async createOffer(onCandidate: (candidate: RTCIceCandidate) => void): Promise<RTCSessionDescriptionInit | null> {
    try {
      const pc = this.initPeerConnection(onCandidate);
      const stream = await this.getLocalAudioStream();
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.warn('[WebRTC] Error creating offer:', err);
      return null;
    }
  }

  // Receiver answers WebRTC Offer
  public async handleOffer(
    offerSdp: RTCSessionDescriptionInit,
    onCandidate: (candidate: RTCIceCandidate) => void
  ): Promise<RTCSessionDescriptionInit | null> {
    try {
      const pc = this.initPeerConnection(onCandidate);
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

      const stream = await this.getLocalAudioStream();
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    } catch (err) {
      console.warn('[WebRTC] Error handling offer:', err);
      return null;
    }
  }

  // Caller receives WebRTC Answer
  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
      }
    } catch (err) {
      console.warn('[WebRTC] Error handling answer:', err);
    }
  }

  // Add ICE Candidate
  public async addIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
      }
    } catch (err) {
      console.warn('[WebRTC] Error adding ICE candidate:', err);
    }
  }

  // Mute / Unmute local microphone
  public toggleMute(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  // Clean up and release camera & microphone hardware & peer connections
  public cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }
  }
}

export const webrtcService = new WebRTCCallService();
