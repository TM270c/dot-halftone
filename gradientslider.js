class GradientSlider {
    constructor(container) {
      // Main elements
      this.slider = container.querySelector('.gradient-slider');
      this.colorPicker = container.querySelector('#colorPicker');
      this.removeStopBtn = container.querySelector('#removeStopBtn');
      
      // State: initialize with two stops (red to blue)
      this.stops = [
        { position: 0, color: '#ff0000' },
        { position: 100, color: '#0000ff' }
      ];
      this.activeStopIndex = null;
      this.isDragging = false;
      
      // Initialize slider
      this.init();
    }
    
    init() {
      // Create initial stop elements
      this.stops.forEach((stop, index) => {
        this.createStopElement(stop, index);
      });
      
      // Attach event listeners for slider, color picker, and remove button
      this.slider.addEventListener('click', this.handleSliderClick.bind(this));
      this.colorPicker.addEventListener('input', this.handleColorChange.bind(this));
      this.removeStopBtn.addEventListener('click', this.removeActiveStop.bind(this));
      
      // Document-level event listeners for dragging
      document.addEventListener('mousemove', this.handleMouseMove.bind(this));
      document.addEventListener('mouseup', this.handleMouseUp.bind(this));
      document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      document.addEventListener('touchend', this.handleTouchEnd.bind(this));
      
      // Initial update of the gradient display
      this.updateGradient();
    }
    
    createStopElement(stop, index) {
      const stopElement = document.createElement('div');
      stopElement.className = 'color-stop';
      stopElement.setAttribute('data-index', index);
      stopElement.style.backgroundColor = stop.color;
      stopElement.style.left = `${stop.position}%`;
    
      this.slider.appendChild(stopElement);
      this.updateStopPosition(stopElement, stop.position);
    
      // Attach events for dragging this stop
      stopElement.addEventListener('mousedown', this.handleStopMouseDown.bind(this));
      stopElement.addEventListener('touchstart', this.handleStopTouchStart.bind(this), { passive: false });
      // Prevent click from bubbling up to the slider click event
      stopElement.addEventListener('click', e => e.stopPropagation());
    }
    
    handleSliderClick(e) {
      if (this.isDragging) return;
      
      const rect = this.slider.getBoundingClientRect();
      const position = Math.min(Math.max(0, ((e.clientX - rect.left) / rect.width) * 100), 100);
      
      // Create a new stop with interpolated color at this position
      const newStop = {
        position,
        color: this.getGradientColorAtPosition(position)
      };
      
      this.stops.push(newStop);
      this.sortStopsByPosition();
      this.rebuildStops();
      this.setActiveStop(this.stops.indexOf(newStop));
      this.updateGradient();
    }
    
    getGradientColorAtPosition(position) {
      const sortedStops = [...this.stops].sort((a, b) => a.position - b.position);
      let leftStop = sortedStops[0];
      let rightStop = sortedStops[sortedStops.length - 1];
      
      for (let i = 0; i < sortedStops.length - 1; i++) {
        if (sortedStops[i].position <= position && sortedStops[i + 1].position >= position) {
          leftStop = sortedStops[i];
          rightStop = sortedStops[i + 1];
          break;
        }
      }
      
      if (leftStop.position === rightStop.position) {
        return leftStop.color;
      }
      
      const factor = (position - leftStop.position) / (rightStop.position - leftStop.position);
      return this.blendColors(leftStop.color, rightStop.color, factor);
    }
    
    blendColors(color1, color2, factor) {
      const r1 = parseInt(color1.substring(1, 3), 16);
      const g1 = parseInt(color1.substring(3, 5), 16);
      const b1 = parseInt(color1.substring(5, 7), 16);
      
      const r2 = parseInt(color2.substring(1, 3), 16);
      const g2 = parseInt(color2.substring(3, 5), 16);
      const b2 = parseInt(color2.substring(5, 7), 16);
      
      const r = Math.round(r1 + factor * (r2 - r1));
      const g = Math.round(g1 + factor * (g2 - g1));
      const b = Math.round(b1 + factor * (b2 - b1));
      
      const toHex = val => (val < 16 ? '0' : '') + val.toString(16);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    
    handleStopMouseDown(e) {
      const target = e.target;
      const index = parseInt(target.getAttribute('data-index'));
      this.startDragging(index);
      e.preventDefault();
    }
    
    handleStopTouchStart(e) {
      const target = e.target;
      const index = parseInt(target.getAttribute('data-index'));
      this.startDragging(index);
      e.preventDefault();
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
      const touch = e.touches[0];
      this.updateStopDragPosition(touch.clientX);
    }
    
    updateStopDragPosition(clientX) {
      const rect = this.slider.getBoundingClientRect();
      let position = ((clientX - rect.left) / rect.width) * 100;
      position = Math.min(Math.max(0, position), 100);
      
      // Update stop's position in state and DOM
      this.stops[this.activeStopIndex].position = position;
      const stopElement = this.slider.querySelector(`.color-stop[data-index="${this.activeStopIndex}"]`);
      this.updateStopPosition(stopElement, position);
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
      const stopElements = this.slider.querySelectorAll('.color-stop');
      stopElements.forEach(el => el.classList.remove('active'));
      this.activeStopIndex = index;
      if (index !== null) {
        const activeElement = this.slider.querySelector(`.color-stop[data-index="${index}"]`);
        if (activeElement) {
          activeElement.classList.add('active');
        }
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
      const stopElement = this.slider.querySelector(`.color-stop[data-index="${this.activeStopIndex}"]`);
      if (stopElement) {
        stopElement.style.backgroundColor = this.colorPicker.value;
      }
      this.updateGradient();
    }
    
    removeActiveStop() {
      if (this.activeStopIndex === null || this.stops.length <= 2) return;
      this.stops.splice(this.activeStopIndex, 1);
      this.rebuildStops();
      this.setActiveStop(null);
      this.updateGradient();
    }
    
    updateStopPosition(element, position) {
      element.style.left = `${position}%`;
    }
    
    sortStopsByPosition() {
      this.stops.sort((a, b) => a.position - b.position);
    }
    
    rebuildStops() {
      const stopElements = this.slider.querySelectorAll('.color-stop');
      stopElements.forEach(el => el.remove());
      this.stops.forEach((stop, index) => {
        this.createStopElement(stop, index);
      });
      if (this.activeStopIndex !== null) {
        if (this.activeStopIndex >= this.stops.length) {
          this.setActiveStop(this.stops.length - 1);
        } else {
          this.setActiveStop(this.activeStopIndex);
        }
      }
    }
    
    updateGradient() {
      // Create a sorted list of stops and build the CSS gradient string
      const sortedStops = [...this.stops].sort((a, b) => a.position - b.position);
      const gradientStops = sortedStops.map(stop => `${stop.color} ${stop.position}%`).join(', ');
      const gradientCSS = `linear-gradient(to right, ${gradientStops})`;
      // Add horizontal padding so that the end handles are not cut off
      this.slider.style.padding = "0 8px";
      this.slider.style.background = gradientCSS;
    }
    
    getGradientCSS() {
      const sortedStops = [...this.stops].sort((a, b) => a.position - b.position);
      const gradientStops = sortedStops.map(stop => `${stop.color} ${stop.position}%`).join(', ');
      return `linear-gradient(to right, ${gradientStops})`;
    }
    
    getStops() {
      return [...this.stops].sort((a, b) => a.position - b.position);
    }
  }
  