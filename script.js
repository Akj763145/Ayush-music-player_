class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.progressBar = document.querySelector('.progress-bar');
        this.progress = document.getElementById('progress');
        this.progressHandle = document.getElementById('progressHandle');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.trackTitle = document.getElementById('trackTitle');
        this.trackArtist = document.getElementById('trackArtist');
        this.albumArt = document.getElementById('albumArt');
        this.audioUpload = document.getElementById('audioUpload');
        this.playlistContainer = document.querySelector('.playlist-container');
        this.repeatBtn = document.getElementById('repeatBtn'); // Add repeat button

        this.playlist = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isDragging = false;
        this.lastProgressUpdate = 0;
        this.isRepeatAll = true; // Repeat all enabled by default

        this.init();
    }

    init() {
        this.loadSavedPlaylist();
        this.setupEventListeners();
        this.setVolume(50);

        if (this.playlist.length > 0) {
            this.loadTrack(0);
        } else {
            this.trackTitle.textContent = 'No songs in playlist';
            this.trackArtist.textContent = 'Upload music to get started';
            this.albumArt.src = 'https://via.placeholder.com/200x200/000000/ffffff?text=♪';
        }

        this.updatePlaylistDisplay();
    }

    // Save playlist to localStorage
    savePlaylist() {
        try {
            const playlistData = this.playlist.map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                albumArt: track.albumArt,
                saved: track.saved || false,
                // Don't save blob URLs as they're temporary
                src: track.src.startsWith('blob:') ? null : track.src
            }));
            localStorage.setItem('musicPlayerPlaylist', JSON.stringify(playlistData));
            localStorage.setItem('musicPlayerCurrentIndex', this.currentTrackIndex.toString());
        } catch (error) {
            console.warn('Could not save playlist:', error);
        }
    }

    // Load playlist from localStorage
    loadSavedPlaylist() {
        try {
            const savedPlaylist = localStorage.getItem('musicPlayerPlaylist');
            const savedIndex = localStorage.getItem('musicPlayerCurrentIndex');

            if (savedPlaylist) {
                const parsedPlaylist = JSON.parse(savedPlaylist);
                // Filter out tracks with null src (blob URLs that are no longer valid)
                this.playlist = parsedPlaylist.filter(track => track.src !== null);

                if (savedIndex && parseInt(savedIndex) < this.playlist.length) {
                    this.currentTrackIndex = parseInt(savedIndex);
                }
            }
        } catch (error) {
            console.warn('Could not load saved playlist:', error);
        }
    }

    // Generate unique ID for tracks
    generateTrackId() {
        return 'track-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    setupEventListeners() {
        // Play/Pause button
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());

        // Previous/Next buttons
        this.prevBtn.addEventListener('click', () => this.previousTrack());
        this.nextBtn.addEventListener('click', () => this.nextTrack());

        // Progress bar events
        this.progressBar.addEventListener('click', (e) => this.seekTo(e));
        this.progressHandle.addEventListener('mousedown', (e) => this.startDragging(e));
        this.progressBar.addEventListener('mousedown', (e) => this.startDragging(e));
        document.addEventListener('mousemove', (e) => this.dragProgress(e));
        document.addEventListener('mouseup', () => this.stopDragging());
        
        // Touch events for mobile
        this.progressHandle.addEventListener('touchstart', (e) => this.startDragging(e));
        this.progressBar.addEventListener('touchstart', (e) => this.startDragging(e));
        document.addEventListener('touchmove', (e) => this.dragProgress(e));
        document.addEventListener('touchend', () => this.stopDragging());

        // Volume slider
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

        // Audio events
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('timeupdate', this.throttle(() => this.updateProgress(), 100));
        this.audio.addEventListener('ended', () => this.nextTrack());
        this.audio.addEventListener('loadstart', () => this.resetProgress());
        this.audio.addEventListener('error', (e) => this.handleAudioError(e));

        // File upload
        this.audioUpload.addEventListener('change', (e) => this.handleFileUpload(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Playlist item clicks
        this.playlistContainer.addEventListener('click', (e) => this.handlePlaylistClick(e));

        // Repeat button click
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
    }

    togglePlayPause() {
        if (this.playlist.length === 0) return;

        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async play() {
        try {
            await this.audio.play();
            this.isPlaying = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            document.body.classList.add('playing');
        } catch (error) {
            console.warn('Playback failed:', error);
            this.isPlaying = false;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            document.body.classList.remove('playing');
        }
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        document.body.classList.remove('playing');
    }

    previousTrack() {
        if (this.playlist.length === 0) return;

        this.currentTrackIndex = this.currentTrackIndex === 0 
            ? this.playlist.length - 1 
            : this.currentTrackIndex - 1;

        this.loadTrack(this.currentTrackIndex);
        if (this.isPlaying) this.play();
    }

    nextTrack() {
        if (this.playlist.length === 0) return;

        const wasPlaying = this.isPlaying;

        if (this.isRepeatAll) {
          this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        } else {
          if (this.currentTrackIndex < this.playlist.length - 1) {
            this.currentTrackIndex++;
          } else {
            this.pause();
            return;
          }
        }

        this.loadTrack(this.currentTrackIndex);
        
        // Auto-play the next song if the previous one was playing
        if (wasPlaying) {
            // Small delay to ensure track is loaded
            setTimeout(() => {
                this.play();
            }, 100);
        }
    }
    toggleRepeat() {
        this.isRepeatAll = !this.isRepeatAll;
        if (this.isRepeatAll) {
            this.repeatBtn.classList.add('active');
            this.repeatBtn.title = 'Repeat All';
        } else {
            this.repeatBtn.classList.remove('active');
            this.repeatBtn.title = 'Repeat Off';
        }
    }

    loadTrack(index) {
        if (!this.playlist[index]) {
            this.trackTitle.textContent = 'No songs in playlist';
            this.trackArtist.textContent = 'Upload music to get started';
            this.albumArt.src = 'https://via.placeholder.com/200x200/000000/ffffff?text=♪';
            return;
        }

        const track = this.playlist[index];

        try {
            // Reset previous state
            this.pause();
            this.resetProgress();

            // Load new track
            this.audio.src = track.src;
            this.trackTitle.textContent = track.title || 'Unknown Title';
            this.trackArtist.textContent = track.artist || 'Unknown Artist';
            this.albumArt.src = track.albumArt || 'https://via.placeholder.com/200x200/000000/ffffff?text=♪';

            this.currentTrackIndex = index;
            this.updatePlaylistDisplay();
            this.savePlaylist();
        } catch (error) {
            console.warn('Failed to load track:', track.title, error);
            this.trackTitle.textContent = 'Error loading track';
            this.trackArtist.textContent = 'Please try another file';
        }
    }

    seekTo(e) {
        if (!this.audio.duration) return;

        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.audio.duration;

        this.audio.currentTime = time;
        this.updateProgress();
    }

    startDragging(e) {
        this.isDragging = true;
        e.preventDefault();
        
        // Also update position immediately when starting to drag
        this.dragProgress(e);
    }

    dragProgress(e) {
        if (!this.isDragging || !this.audio.duration) return;

        const rect = this.progressBar.getBoundingClientRect();
        let clientX;
        
        // Handle both mouse and touch events
        if (e.touches) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const time = percent * this.audio.duration;

        // Update the visual progress immediately while dragging
        this.progress.style.width = `${percent * 100}%`;
        this.progressHandle.style.left = `${percent * 100}%`;
        this.currentTimeEl.textContent = this.formatTime(time);
        
        // Update audio time
        this.audio.currentTime = time;
    }

    stopDragging() {
        this.isDragging = false;
    }

    updateProgress() {
        if (this.isDragging) return;

        const currentTime = this.audio.currentTime || 0;
        const duration = this.audio.duration || 0;

        if (duration && !isNaN(currentTime) && !isNaN(duration)) {
            const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));
            
            // Smooth animation for progress updates
            requestAnimationFrame(() => {
                this.progress.style.width = `${percent}%`;
                this.progressHandle.style.left = `${percent}%`;
            });
        }

        this.currentTimeEl.textContent = this.formatTime(currentTime);
    }

    updateDuration() {
        this.durationEl.textContent = this.formatTime(this.audio.duration);
    }

    resetProgress() {
        this.progress.style.width = '0%';
        this.progressHandle.style.left = '0%';
        this.currentTimeEl.textContent = '0:00';
        this.durationEl.textContent = '0:00';
    }

    setVolume(value) {
        this.audio.volume = value / 100;
        this.volumeSlider.value = value;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    handleFileUpload(e) {
        const files = Array.from(e.target.files);

        files.forEach(file => {
            if (file.type.startsWith('audio/') && file.size < 50 * 1024 * 1024) { // 50MB limit
                try {
                    const url = URL.createObjectURL(file);
                    const track = {
                        id: this.generateTrackId(),
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        artist: 'Unknown Artist',
                        src: url,
                        albumArt: 'https://via.placeholder.com/200x200/333333/ffffff?text=♪',
                        saved: false
                    };

                    this.playlist.push(track);

                    // If this is the first track, load it
                    if (this.playlist.length === 1) {
                        this.loadTrack(0);
                    }
                } catch (error) {
                    console.warn('Failed to load file:', file.name, error);
                }
            } else if (file.size >= 50 * 1024 * 1024) {
                alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
            }
        });

        this.updatePlaylistDisplay();
        this.savePlaylist();

        // Reset file input
        e.target.value = '';
    }

    updatePlaylistDisplay() {
        // Remove existing playlist items (except upload section)
        const existingItems = this.playlistContainer.querySelectorAll('.playlist-item:not(.upload-section)');
        existingItems.forEach(item => item.remove());

        // Add current playlist items
        const uploadSection = this.playlistContainer.querySelector('.upload-section');

        this.playlist.forEach((track, index) => {
            const playlistItem = document.createElement('div');
            playlistItem.className = `playlist-item ${index === this.currentTrackIndex ? 'active' : ''}`;
            playlistItem.dataset.index = index;

            playlistItem.innerHTML = `
                <i class="fas fa-music"></i>
                <div class="track-details">
                    <span class="track-name">${track.title}</span>
                    <span class="track-artist">${track.artist}</span>
                </div>
                <div class="track-controls">
                    <button class="save-btn ${track.saved ? 'saved' : ''}" data-index="${index}" title="${track.saved ? 'Saved' : 'Save track'}">
                        <i class="fas ${track.saved ? 'fa-heart' : 'fa-heart-o'}"></i>
                    </button>
                    <button class="remove-btn" data-index="${index}" title="Remove track">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            this.playlistContainer.insertBefore(playlistItem, uploadSection);
        });
    }

    handlePlaylistClick(e) {
        // Handle save button clicks
        if (e.target.closest('.save-btn')) {
            const index = parseInt(e.target.closest('.save-btn').dataset.index);
            this.toggleSaveTrack(index);
            return;
        }

        // Handle remove button clicks
        if (e.target.closest('.remove-btn')) {
            const index = parseInt(e.target.closest('.remove-btn').dataset.index);
            this.removeTrack(index);
            return;
        }

        // Handle playlist item clicks
        const playlistItem = e.target.closest('.playlist-item:not(.upload-section)');
        if (playlistItem) {
            const index = parseInt(playlistItem.dataset.index);
            if (index !== -1 && index < this.playlist.length) {
                this.currentTrackIndex = index;
                this.loadTrack(index);
                if (this.isPlaying) this.play();
            }
        }
    }

    // Toggle save status of a track
    toggleSaveTrack(index) {
        if (this.playlist[index]) {
            this.playlist[index].saved = !this.playlist[index].saved;
            this.updatePlaylistDisplay();
            this.savePlaylist();
        }
    }

    // Remove track from playlist
    removeTrack(index) {
        if (this.playlist.length <= 1) {
            alert('Cannot remove the last track in the playlist');
            return;
        }

        if (confirm('Are you sure you want to remove this track?')) {
            // Revoke blob URL if it exists
            if (this.playlist[index].src.startsWith('blob:')) {
                URL.revokeObjectURL(this.playlist[index].src);
            }

            this.playlist.splice(index, 1);

            // Adjust current track index
            if (index === this.currentTrackIndex) {
                // If we removed the current track, play the next one (or previous if it was the last)
                if (index >= this.playlist.length) {
                    this.currentTrackIndex = this.playlist.length - 1;
                }
                this.loadTrack(this.currentTrackIndex);
            } else if (index < this.currentTrackIndex) {
                this.currentTrackIndex--;
            }

            this.updatePlaylistDisplay();
            this.savePlaylist();
        }
    }

    // Throttle function for performance
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    // Handle audio errors
    handleAudioError(e) {
        console.warn('Audio error:', e);
        this.trackTitle.textContent = 'Error playing audio';
        this.trackArtist.textContent = 'Please check the file format';
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        document.body.classList.remove('playing');
    }

    handleKeyPress(e) {
        // Prevent default only for our shortcuts to avoid interfering with other page functionality
        switch(e.code) {
            case 'Space':
                if (e.target === document.body) {
                    e.preventDefault();
                    this.togglePlayPause();
                }
                break;
            case 'ArrowLeft':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.previousTrack();
                }
                break;
            case 'ArrowRight':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.nextTrack();
                }
                break;
            case 'ArrowUp':
                if (e.ctrlKey) {
                    e.preventDefault();
                    const newVolume = Math.min(100, parseInt(this.volumeSlider.value) + 10);
                    this.setVolume(newVolume);
                }
                break;
            case 'ArrowDown':
                if (e.ctrlKey) {
                    e.preventDefault();
                    const newVolume = Math.max(0, parseInt(this.volumeSlider.value) - 10);
                    this.setVolume(newVolume);
                }
                break;
        }
    }
}

// Initialize the music player when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});