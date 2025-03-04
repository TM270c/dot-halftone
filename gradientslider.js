class GradientSlider {
  constructor(container) {
    this.container = container;
    this.slider = container.querySelector('.gradient-slider');
    this.colorPicker = container.querySelector('#colorPicker');
    this.removeStopBtn = container.querySelector('#removeStopBtn');

    // Initialize with two stops (red at 0% and blue at 100%)
    this.stops = [
      { position: 0, color: '#ff0000' },
      { position: 100, color: '#0000ff' }
    ];
    this.activeStopIndex = null;
    this.isDragging = false;
    this.init();
  }
  
  init() {
    this.stops.forEach((stop, i) => this.createStopElement(stop, i));
    this.slider.addEventListener('click', this.handleSliderClick.bind(this));
    this.colorPicker.addEventListener('input', this.handleColorChange.bind(this));
    this.removeStopBtn.addEventListener('click', this.removeActiveStop.bind(this));
    
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    
    this.updateGradient();
  }
  
  createStopElement(stop, index) {
    const el = document.createElement('div');
    el.className = 'color-stop';
    el.dataset.index = index;
    el.style.backgroundColor = stop.color;
    el.style.left = `${stop.position}%`;
    this.slider.appendChild(el);
    this.updateStopPosition(el, stop.position);
    
    const startDrag = (e) => {
      this.startDragging(index);
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener('mousedown', startDrag);
    el.addEventListener('touchstart', startDrag, { passive: false });
    el.addEventListener('click', (e) => e.stopPropagation());
  }
  
  handleSliderClick(e) {
    if (this.isDragging) return;
    const rect = this.slider.getBoundingClientRect();
    const pos = Math.min(Math.max(0, ((e.clientX - rect.left) / rect.width) * 100), 100);
    const newStop = { position: pos, color: this.getGradientColorAtPosition(pos) };
    this.stops.push(newStop);
    this.sortStopsByPosition();
    this.rebuildStops();
    this.setActiveStop(this.stops.indexOf(newStop));
    this.updateGradient();
  }
  
  getGradientColorAtPosition(position) {
    const sortedStops = [...this.stops].sort((a, b) => a.position - b.position);
    // Clamp the position within the bounds of the stops
    if (position <= sortedStops[0].position) return sortedStops[0].color;
    if (position >= sortedStops[sortedStops.length - 1].position) return sortedStops[sortedStops.length - 1].color;
    
    let leftStop = sortedStops[0], rightStop = sortedStops[sortedStops.length - 1];
    for (let i = 0; i < sortedStops.length - 1; i++) {
      if (sortedStops[i].position <= position && sortedStops[i + 1].position >= position) {
        leftStop = sortedStops[i];
        rightStop = sortedStops[i + 1];
        break;
      }
    }
    
    if (leftStop.position === rightStop.position) return leftStop.color;
    const factor = (position - leftStop.position) / (rightStop.position - leftStop.position);
    return this.blendColors(leftStop.color, rightStop.color, factor);
  }
  
  
  blendColors(c1, c2, factor) {
    const hexToRgb = (hex) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    });
    const rgbToHex = ({ r, g, b }) =>
      '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    const rgb1 = hexToRgb(c1), rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
    const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
    const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
    return rgbToHex({ r, g, b });
  }
  
  startDragging(index) {
    this.setActiveStop(index);
    this.isDragging = true;
  }
  
  handleMouseMove(e) {
    if (!this.isDragging || this.activeStopIndex === null) return;
    this.updateStopDragPosition(e.clientX);
  }
  
  handleTouchMove(e) {
    if (!this.isDragging || this.activeStopIndex === null) return;
    e.preventDefault();
    this.updateStopDragPosition(e.touches[0].clientX);
  }
  
  updateStopDragPosition(clientX) {
    const rect = this.slider.getBoundingClientRect();
    let pos = ((clientX - rect.left) / rect.width) * 100;
    pos = Math.min(Math.max(0, pos), 100);
    this.stops[this.activeStopIndex].position = pos;
    const el = this.slider.querySelector(`.color-stop[data-index="${this.activeStopIndex}"]`);
    if (el) this.updateStopPosition(el, pos);
    this.updateGradient();
  }
  
  handleMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.sortStopsByPosition();
      this.rebuildStops();
    }
  }
  
  handleTouchEnd() {
    if (this.isDragging) {
      this.isDragging = false;
      this.sortStopsByPosition();
      this.rebuildStops();
    }
  }
  
  setActiveStop(index) {
    this.slider.querySelectorAll('.color-stop').forEach(el => el.classList.remove('active'));
    this.activeStopIndex = index;
    if (index !== null) {
      const activeEl = this.slider.querySelector(`.color-stop[data-index="${index}"]`);
      if (activeEl) activeEl.classList.add('active');
      this.colorPicker.value = this.stops[index].color;
      this.colorPicker.disabled = false;
      this.removeStopBtn.disabled = this.stops.length <= 2;
    } else {
      this.colorPicker.disabled = true;
      this.removeStopBtn.disabled = true;
    }
  }
  
  handleColorChange() {
    if (this.activeStopIndex === null) return;
    this.stops[this.activeStopIndex].color = this.colorPicker.value;
    const el = this.slider.querySelector(`.color-stop[data-index="${this.activeStopIndex}"]`);
    if (el) el.style.backgroundColor = this.colorPicker.value;
    this.updateGradient();
  }
  
  removeActiveStop() {
    if (this.activeStopIndex === null || this.stops.length <= 2) return;
    this.stops.splice(this.activeStopIndex, 1);
    this.rebuildStops();
    this.setActiveStop(null);
    this.updateGradient();
  }
  
  updateStopPosition(el, pos) {
    el.style.left = `${pos}%`;
  }
  
  sortStopsByPosition() {
    this.stops.sort((a, b) => a.position - b.position);
  }
  
  rebuildStops() {
    this.slider.querySelectorAll('.color-stop').forEach(el => el.remove());
    this.stops.forEach((stop, i) => this.createStopElement(stop, i));
    if (this.activeStopIndex !== null) {
      this.setActiveStop(Math.min(this.activeStopIndex, this.stops.length - 1));
    }
  }
  
  updateGradient() {
    const sorted = [...this.stops].sort((a, b) => a.position - b.position);
    const stopsCSS = sorted.map(s => `${s.color} ${s.position}%`).join(', ');
    this.slider.style.padding = "0 8px";
    this.slider.style.background = `linear-gradient(to right, ${stopsCSS})`;
  }
  
  getGradientCSS() {
    const sorted = [...this.stops].sort((a, b) => a.position - b.position);
    return `linear-gradient(to right, ${sorted.map(s => `${s.color} ${s.position}%`).join(', ')})`;
  }
  
  getStops() {
    return [...this.stops].sort((a, b) => a.position - b.position);
  }
}
 