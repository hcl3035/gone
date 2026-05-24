// wall-drawing.js - 涂鸦绘制功能
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallDrawing = {
        setupToolsWithoutInit: function(modal) {
            const colorPicker = modal.querySelector('.color-picker');
            const brushSize = modal.querySelector('.brush-size');
            const opacitySlider = modal.querySelector('.opacity-slider');
            const opacityValue = modal.querySelector('.opacity-value');
            const undoBtn = modal.querySelector('.draw-undo');
            const redoBtn = modal.querySelector('.draw-redo');
            const clearBtn = modal.querySelector('.draw-clear');
            const downloadBtn = modal.querySelector('.download-annotated');
            
            const self = this;
            
            // 工具切换
            const toolButtons = modal.querySelectorAll('[data-tool]');
            toolButtons.forEach(function(btn) {
                btn.onclick = function() {
                    const previousTool = State.currentTool;
                    
                    toolButtons.forEach(function(b) { b.classList.remove('active'); });
                    this.classList.add('active');
                    State.currentTool = this.dataset.tool;
                    
                    // 关键修复：同步更新下拉菜单的active状态
                    const dropdownItems = modal.querySelectorAll('.tool-dropdown-item');
                    dropdownItems.forEach(function(item) {
                        item.classList.remove('active');
                        if (item.dataset.tool === State.currentTool) {
                            item.classList.add('active');
                        }
                    });
                    
                    // 关键修复：只有切换到非直线/箭头工具时才隐藏线段控制点
                    const isLineTool = State.currentTool === 'straight-line' || State.currentTool === 'arrow';
                    const wasLineTool = previousTool === 'straight-line' || previousTool === 'arrow';
                    
                    if (!isLineTool && wasLineTool) {
                        // 从直线/箭头工具切换到其他工具，隐藏控制点
                        if (window.hideLineHandles) {
                            window.hideLineHandles();
                        }
                    } else if (!isLineTool && !wasLineTool) {
                        // 从其他工具切换到其他工具，也隐藏控制点（如果有的话）
                        if (window.hideLineHandles) {
                            window.hideLineHandles();
                        }
                    }
                    // 如果是从直线切换到箭头或反之，保持控制点显示
                    
                    // 关键修复：只有绘图工具才设置isDrawingMode为true
                    const drawingTools = ['brush', 'straight-line', 'eraser', 'arrow', 'rect', 'circle'];
                    State.isDrawingMode = drawingTools.includes(State.currentTool);
                    
                    const cursorMap = {
                        'hand': 'grab',
                        'select': 'default',
                        'text': 'text',
                        'eraser': 'cell'
                    };
                    const cursor = cursorMap[State.currentTool] || 'crosshair';
                    self.updateAllCursors(cursor);
                    self.enableAllCanvases();
                };
            });

            colorPicker.onchange = function() {
                State.drawColor = this.value;
                console.log('颜色已更新:', State.drawColor);
            };
            
            // 关键修复：添加input事件，实时响应颜色变化
            colorPicker.addEventListener('input', function() {
                State.drawColor = this.value;
                console.log('颜色实时更新:', State.drawColor);
            });

            brushSize.oninput = function() {
                State.drawWidth = parseInt(this.value);
            };

            opacitySlider.oninput = function() {
                State.drawOpacity = parseFloat(this.value);
                if (opacityValue) {
                    opacityValue.textContent = Math.round(State.drawOpacity * 100) + '%';
                }
                console.log('透明度已更新:', State.drawOpacity);
            };

            undoBtn.onclick = function() {
                const history = State.drawingHistory[State.activeCanvasIndex];
                if (history && history.length > 0) {
                    if (!State.redoHistory[State.activeCanvasIndex]) {
                        State.redoHistory[State.activeCanvasIndex] = [];
                    }
                    State.redoHistory[State.activeCanvasIndex].push(history.pop());
                    self.restoreCanvas();
                }
            };

            redoBtn.onclick = function() {
                const redo = State.redoHistory[State.activeCanvasIndex];
                if (redo && redo.length > 0) {
                    State.drawingHistory[State.activeCanvasIndex].push(redo.pop());
                    self.restoreCanvas();
                }
            };

            clearBtn.onclick = function() {
                console.log('=== Clear button clicked ===');
                console.log('activeCanvasIndex:', State.activeCanvasIndex);
                console.log('layerCanvases count:', State.layerCanvases.length);
                
                // 关键修复：只清空被选中（可见）的图层
                let clearedCount = 0;
                State.layerCanvases.forEach((layer, index) => {
                    if (layer && layer.ctx && State.layers[index] && State.layers[index].visible) {
                        console.log(`Clearing visible layer ${index}`);
                        self.saveState();
                        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
                        clearedCount++;
                    }
                });
                
                if (clearedCount === 0) {
                    console.warn('No visible layers to clear');
                    alert('没有可见的图层可以清空！');
                } else {
                    console.log(`Cleared ${clearedCount} visible layer(s)`);
                }
            };

            downloadBtn.onclick = function() {
                self.downloadAnnotated();
            };

            // 注意：不调用initLayers，等待图片加载完成
        },

        setupTools: function(modal) {
            this.setupToolsWithoutInit(modal);
            // 为了兼容性，仍然保留原方法
        },

        initLayers: function(modal) {
            const container = modal.querySelector('.layers-container');
            if (!container) {
                console.error('layers-container not found');
                return;
            }

            console.log('initLayers called, container children:', container.children.length);

            // 关键修复：只清除Canvas，不清除图片
            const oldCanvases = container.querySelectorAll('.annotation-layer');
            oldCanvases.forEach(canvas => canvas.remove());
            
            State.layerCanvases = [];
            State.drawingHistory = [[]];
            State.redoHistory = [[]];

            const layer = this.createLayer(modal, 0);
            if (layer) {
                State.layerCanvases[0] = layer;
                this.bindCanvasEvents(layer.canvas, 0);
                console.log('Layer 0 created successfully:', layer);
            } else {
                console.error('Failed to create layer 0');
            }
        },

        createLayer: function(modal, layerIndex) {
            console.log('createLayer called with modal:', modal, 'layerIndex:', layerIndex);
            console.log('modal type:', typeof modal, 'modal.tagName:', modal ? modal.tagName : 'null');
            
            // 关键修复：确保modal是DOM元素
            if (!modal || !modal.querySelector) {
                console.error('Invalid modal parameter:', modal);
                // 尝试从全局获取modal
                modal = document.getElementById('imageModal');
                if (!modal) {
                    console.error('Cannot find imageModal');
                    return null;
                }
            }
            
            const layersContainer = modal.querySelector('.layers-container');
            if (!layersContainer) {
                console.error('layers-container not found in createLayer');
                return null;
            }

            // 关键修复：从多个位置查找图片
            let img = layersContainer.querySelector('.modal-image');
            
            if (!img) {
                const imgContainer = modal.querySelector('.modal-image-container');
                if (imgContainer) {
                    img = imgContainer.querySelector('.modal-image');
                    console.log('Trying to find image in modal-image-container:', img ? 'found' : 'not found');
                    if (imgContainer.children.length > 0) {
                        console.log('modal-image-container children:');
                        for (let i = 0; i < imgContainer.children.length; i++) {
                            console.log('  Child', i, ':', imgContainer.children[i].className, imgContainer.children[i].tagName);
                        }
                    }
                }
            }
            
            if (!img) {
                // 最后尝试：直接从modal中查找
                img = modal.querySelector('.modal-image');
                console.log('Trying to find image directly in modal:', img ? 'found' : 'not found');
            }
            
            if (!img) {
                console.error('modal-image not found anywhere');
                console.log('layers-container children count:', layersContainer.children.length);
                for (let i = 0; i < layersContainer.children.length; i++) {
                    console.log('Child', i, ':', layersContainer.children[i].className, layersContainer.children[i].tagName);
                }
                console.log('modal children count:', modal.children.length);
                for (let i = 0; i < modal.children.length; i++) {
                    console.log('Modal Child', i, ':', modal.children[i].className, modal.children[i].tagName);
                }
                return null;
            }
            
            if (!img.complete || !img.naturalWidth) {
                console.error('modal-image not loaded or has no natural width');
                console.log('img.complete:', img.complete, 'img.naturalWidth:', img.naturalWidth);
                return null;
            }

            const canvas = document.createElement('canvas');
            canvas.className = 'annotation-layer';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'auto';
            canvas.style.zIndex = layerIndex;
            canvas.style.cursor = 'crosshair';

            console.log('Image natural size:', img.naturalWidth, 'x', img.naturalHeight);

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            layersContainer.appendChild(canvas);

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            console.log('Canvas created:', canvas.width, 'x', canvas.height);

            return {
                canvas: canvas,
                ctx: ctx,
                index: layerIndex,
                element: canvas
            };
        },

        bindCanvasEvents: function(canvas, layerIndex) {
            let startX = 0;
            let startY = 0;
            let tempCanvas = null;
            let tempCtx = null;
            const self = this;
            
            // 用于直线画笔的快照
            let brushSnapshot = null;
            
            // 关键修复：线段编辑状态
            let currentLine = null; // {startX, startY, endX, endY, tool: 'straight-line' | 'arrow'}
            let isEditingLine = false;
            let editingEndpoint = null; // 'start' | 'end'
            let lineHandlesContainer = null;
            let cleanSnapshot = null; // 关键修复：保存干净的快照（不包含当前线段）

            // 获取图片引用（从layers-container内部）
            const img = canvas.parentElement.querySelector('.modal-image');

            // 关键修复：监听窗口resize，重新调整Canvas尺寸
            const resizeObserver = new ResizeObserver(function(entries) {
                for (let entry of entries) {
                    const newWidth = entry.contentRect.width;
                    const newHeight = entry.contentRect.height;
                    
                    // 保存当前Canvas内容
                    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                    
                    // 调整Canvas显示尺寸（CSS）
                    canvas.style.width = newWidth + 'px';
                    canvas.style.height = newHeight + 'px';
                    
                    // 注意：不改变canvas.width/height，保持原始绘图分辨率
                }
            });
            
            resizeObserver.observe(canvas.parentElement);

            canvas.addEventListener('mousedown', function(e) {
                // 关键修复：如果是文字工具，不处理Canvas绘图，而是显示文字输入框
                if (State.currentTool === 'text') {
                    if (window.WallText && window.WallText.showInput) {
                        window.WallText.showInput(e.clientX, e.clientY);
                    }
                    return;
                }
                
                if (!State.isDrawingMode || layerIndex !== State.activeCanvasIndex) return;

                handleDrawStart(e);
            });

            // 关键修复：添加触摸事件支持
            canvas.addEventListener('touchstart', function(e) {
                e.preventDefault();
                
                const touch = e.touches[0];
                if (State.currentTool === 'text') {
                    if (window.WallText && window.WallText.showInput) {
                        window.WallText.showInput(touch.clientX, touch.clientY);
                    }
                    return;
                }
                
                if (!State.isDrawingMode || layerIndex !== State.activeCanvasIndex) return;

                // 模拟鼠标事件对象
                const mockEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                };
                handleDrawStart(mockEvent);
            }, { passive: false });
            
            // 关键修复：添加触摸视觉反馈
            canvas.style.touchAction = 'none';
            canvas.style.webkitTapHighlightColor = 'transparent';

            function handleDrawStart(e) {
                // 关键修复：如果是文字工具，不处理Canvas绘图，而是显示文字输入框
                if (State.currentTool === 'text') {
                    if (window.WallText && window.WallText.showInput) {
                        window.WallText.showInput(e.clientX, e.clientY);
                    }
                    return;
                }
                
                if (!State.isDrawingMode || layerIndex !== State.activeCanvasIndex) return;

                // 关键修复：直接使用鼠标相对于canvas的位置，考虑缩放
                const rect = canvas.getBoundingClientRect();
                console.log('Canvas rect:', rect);
                console.log('Canvas 原始尺寸:', canvas.width, 'x', canvas.height);
                console.log('Canvas 显示尺寸:', rect.width, 'x', rect.height);
                console.log('State.scale:', State.currentScale);
                console.log('State.translate:', State.translateX, State.translateY);
                
                // 计算鼠标在canvas显示区域内的相对位置（0-1之间）
                const relativeX = (e.clientX - rect.left) / rect.width;
                const relativeY = (e.clientY - rect.top) / rect.height;
                
                console.log('相对位置:', relativeX.toFixed(4), relativeY.toFixed(4));
                
                // 转换为原始图片坐标
                startX = relativeX * canvas.width;
                startY = relativeY * canvas.height;

                console.log('计算的原始坐标:', startX.toFixed(2), startY.toFixed(2));
                console.log('==================');

                State.isDrawing = true;
                self.saveState();

                // 创建临时Canvas用于预览
                tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(canvas, 0, 0);

                // 为直线画笔保存快照
                if (State.currentTool === 'straight-line' || State.currentTool === 'arrow' || State.currentTool === 'rect' || State.currentTool === 'circle') {
                    brushSnapshot = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                }

                if (State.currentTool === 'brush' || State.currentTool === 'straight-line' || State.currentTool === 'eraser' || State.currentTool === 'arrow' || State.currentTool === 'rect' || State.currentTool === 'circle') {
                    const ctx = canvas.getContext('2d');
                    // 关键修复：每次都重新设置绘图属性，确保使用最新状态
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = State.drawWidth;
                    ctx.strokeStyle = State.drawColor;
                    ctx.fillStyle = State.drawColor;
                    ctx.globalAlpha = State.drawOpacity;

                    if (State.currentTool === 'eraser') {
                        ctx.globalCompositeOperation = 'destination-out';
                    } else {
                        ctx.globalCompositeOperation = 'source-over';
                    }

                    ctx.beginPath();
                    ctx.moveTo(startX, startY);

                    // 关键修复：同时监听鼠标和触摸移动事件
                    canvas.addEventListener('mousemove', draw);
                    canvas.addEventListener('mouseup', stopDrawing);
                    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
                    canvas.addEventListener('touchend', stopDrawing);
                }
            }

            function handleTouchMove(e) {
                e.preventDefault();
                const touch = e.touches[0];
                const mockEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                };
                draw(mockEvent);
            }

            function draw(e) {
                if (!State.isDrawing) return;

                const rect = canvas.getBoundingClientRect();
                const relativeX = (e.clientX - rect.left) / rect.width;
                const relativeY = (e.clientY - rect.top) / rect.height;
                const currentX = relativeX * canvas.width;
                const currentY = relativeY * canvas.height;

                const ctx = canvas.getContext('2d');

                if (State.currentTool === 'brush' || State.currentTool === 'eraser') {
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(currentX, currentY);
                } else if (State.currentTool === 'straight-line' || State.currentTool === 'arrow') {
                    // 恢复快照
                    ctx.putImageData(brushSnapshot, 0, 0);
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(currentX, currentY);
                    ctx.stroke();
                    
                    // 记录终点坐标
                    lastDrawEndX = currentX;
                    lastDrawEndY = currentY;
                    
                    // 如果是箭头，绘制箭头头部
                    if (State.currentTool === 'arrow') {
                        const angle = Math.atan2(currentY - startY, currentX - startX);
                        const arrowLength = State.drawWidth * 3;
                        const arrowAngle = Math.PI / 6;
                        
                        ctx.beginPath();
                        ctx.moveTo(currentX, currentY);
                        ctx.lineTo(
                            currentX - arrowLength * Math.cos(angle - arrowAngle),
                            currentY - arrowLength * Math.sin(angle - arrowAngle)
                        );
                        ctx.moveTo(currentX, currentY);
                        ctx.lineTo(
                            currentX - arrowLength * Math.cos(angle + arrowAngle),
                            currentY - arrowLength * Math.sin(angle + arrowAngle)
                        );
                        ctx.stroke();
                    }
                } else if (State.currentTool === 'rect') {
                    ctx.putImageData(brushSnapshot, 0, 0);
                    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
                } else if (State.currentTool === 'circle') {
                    ctx.putImageData(brushSnapshot, 0, 0);
                    const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
                    ctx.beginPath();
                    ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                }
            }

            function stopDrawing() {
                State.isDrawing = false;
                canvas.removeEventListener('mousemove', draw);
                canvas.removeEventListener('mouseup', stopDrawing);
                canvas.removeEventListener('touchmove', handleTouchMove);
                canvas.removeEventListener('touchend', stopDrawing);
                
                // 关键修复：绘制完直线或箭头后，自动显示控制点
                if ((State.currentTool === 'straight-line' || State.currentTool === 'arrow') && !isEditingLine) {
                    currentLine = {
                        startX: startX,
                        startY: startY,
                        endX: lastDrawEndX,
                        endY: lastDrawEndY,
                        tool: State.currentTool
                    };
                    
                    // 关键修复：使用brushSnapshot作为干净快照（绘制前的状态）
                    cleanSnapshot = brushSnapshot;
                    
                    // 关键修复：绘制完成后自动显示控制点，方便立即调整
                    showLineHandles();
                }
                
                brushSnapshot = null;
            }
            
            // 记录最后绘制的终点坐标
            let lastDrawEndX = 0;
            let lastDrawEndY = 0;
            
            // 关键修复：显示线段控制点（内部函数）
            function showLineHandles() {
                if (!currentLine) return;
                
                // 移除旧的控制点容器
                if (lineHandlesContainer) {
                    lineHandlesContainer.remove();
                }
                
                // 创建新的控制点容器
                lineHandlesContainer = document.createElement('div');
                lineHandlesContainer.className = 'line-handles-container';
                lineHandlesContainer.style.position = 'absolute';
                lineHandlesContainer.style.top = '0';
                lineHandlesContainer.style.left = '0';
                lineHandlesContainer.style.width = '100%';
                lineHandlesContainer.style.height = '100%';
                lineHandlesContainer.style.pointerEvents = 'none';
                lineHandlesContainer.style.zIndex = '10001';
                
                // 获取图片元素
                const img = canvas.parentElement.querySelector('.modal-image');
                if (!img) return;
                
                // 计算缩放比例
                const scaleX = img.offsetWidth / canvas.width;
                const scaleY = img.offsetHeight / canvas.height;
                
                // 创建起点控制点
                const startHandle = document.createElement('div');
                startHandle.className = 'line-handle line-handle-start';
                startHandle.style.position = 'absolute';
                startHandle.style.width = '20px';  // 关键修复：减小到20px
                startHandle.style.height = '20px';
                startHandle.style.borderRadius = '50%';
                startHandle.style.backgroundColor = State.drawColor;  // 关键修复：使用当前线段颜色
                startHandle.style.border = '2px solid white';
                startHandle.style.boxShadow = '0 0 6px rgba(0,0,0,0.4)';
                startHandle.style.cursor = 'move';
                startHandle.style.pointerEvents = 'auto';
                startHandle.style.opacity = '0.7';  // 关键修复：半透明效果
                startHandle.style.left = (currentLine.startX * scaleX - 10) + 'px';  // 调整位置
                startHandle.style.top = (currentLine.startY * scaleY - 10) + 'px';
                startHandle.style.touchAction = 'none';  // 防止触摸时滚动页面
                
                // 创建终点控制点
                const endHandle = document.createElement('div');
                endHandle.className = 'line-handle line-handle-end';
                endHandle.style.position = 'absolute';
                endHandle.style.width = '20px';  // 关键修复：减小到20px
                endHandle.style.height = '20px';
                endHandle.style.borderRadius = '50%';
                endHandle.style.backgroundColor = State.drawColor;  // 关键修复：使用当前线段颜色
                endHandle.style.border = '2px solid white';
                endHandle.style.boxShadow = '0 0 6px rgba(0,0,0,0.4)';
                endHandle.style.cursor = 'move';
                endHandle.style.pointerEvents = 'auto';
                endHandle.style.opacity = '0.7';  // 关键修复：半透明效果
                endHandle.style.left = (currentLine.endX * scaleX - 10) + 'px';  // 调整位置
                endHandle.style.top = (currentLine.endY * scaleY - 10) + 'px';
                endHandle.style.touchAction = 'none';  // 防止触摸时滚动页面
                
                // 添加拖动事件
                let isDragging = false;
                let dragEndpoint = null;
                
                function handleMouseDown(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    isDragging = true;
                    dragEndpoint = this.classList.contains('line-handle-start') ? 'start' : 'end';
                    this.style.transform = 'scale(1.2)';
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                }
                
                // 关键修复：添加触摸事件支持
                function handleTouchStart(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    isDragging = true;
                    dragEndpoint = this.classList.contains('line-handle-start') ? 'start' : 'end';
                    this.style.transform = 'scale(1.2)';
                    
                    document.addEventListener('touchmove', handleTouchMove, { passive: false });
                    document.addEventListener('touchend', handleTouchEnd);
                }
                
                function handleTouchMove(e) {
                    if (!isDragging || !currentLine) return;
                    e.preventDefault();
                    
                    const touch = e.touches[0];
                    const rect = canvas.getBoundingClientRect();
                    const relativeX = (touch.clientX - rect.left) / rect.width;
                    const relativeY = (touch.clientY - rect.top) / rect.height;
                    const newX = relativeX * canvas.width;
                    const newY = relativeY * canvas.height;
                    
                    // 更新线段端点
                    if (dragEndpoint === 'start') {
                        currentLine.startX = newX;
                        currentLine.startY = newY;
                    } else {
                        currentLine.endX = newX;
                        currentLine.endY = newY;
                    }
                    
                    // 重绘线段
                    redrawLine();
                    
                    // 更新控制点位置
                    const handle = dragEndpoint === 'start' ? startHandle : endHandle;
                    handle.style.left = (newX * scaleX - 22) + 'px';
                    handle.style.top = (newY * scaleY - 22) + 'px';
                }
                
                function handleTouchEnd(e) {
                    if (isDragging) {
                        isDragging = false;
                        startHandle.style.transform = 'scale(1)';
                        endHandle.style.transform = 'scale(1)';
                        document.removeEventListener('touchmove', handleTouchMove);
                        document.removeEventListener('touchend', handleTouchEnd);
                        
                        // 保存状态到历史
                        self.saveState();
                    }
                }
                
                function handleMouseMove(e) {
                    if (!isDragging || !currentLine) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const relativeX = (e.clientX - rect.left) / rect.width;
                    const relativeY = (e.clientY - rect.top) / rect.height;
                    const newX = relativeX * canvas.width;
                    const newY = relativeY * canvas.height;
                    
                    // 更新线段端点
                    if (dragEndpoint === 'start') {
                        currentLine.startX = newX;
                        currentLine.startY = newY;
                    } else {
                        currentLine.endX = newX;
                        currentLine.endY = newY;
                    }
                    
                    // 重绘线段
                    redrawLine();
                    
                    // 更新控制点位置
                    const handle = dragEndpoint === 'start' ? startHandle : endHandle;
                    handle.style.left = (newX * scaleX - 8) + 'px';
                    handle.style.top = (newY * scaleY - 8) + 'px';
                }
                
                function handleMouseUp(e) {
                    if (isDragging) {
                        isDragging = false;
                        startHandle.style.transform = 'scale(1)';
                        endHandle.style.transform = 'scale(1)';
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        
                        // 保存状态到历史
                        self.saveState();
                    }
                }
                
                startHandle.addEventListener('mousedown', handleMouseDown);
                endHandle.addEventListener('mousedown', handleMouseDown);
                
                // 关键修复：添加触摸事件监听器
                startHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
                endHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
                
                // 添加到容器
                lineHandlesContainer.appendChild(startHandle);
                lineHandlesContainer.appendChild(endHandle);
                
                // 将容器添加到图片父元素
                img.parentElement.appendChild(lineHandlesContainer);
                
                // 暴露隐藏函数到全局
                window.hideLineHandles = function() {
                    if (lineHandlesContainer) {
                        lineHandlesContainer.remove();
                        lineHandlesContainer = null;
                        currentLine = null;
                    }
                };
            }
            
            // 重绘线段（内部函数）
            function redrawLine() {
                if (!currentLine) return;
                
                const ctx = canvas.getContext('2d');
                
                // 关键修复：清除整个canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 关键修复：恢复干净的快照（不包含当前线段）
                if (cleanSnapshot) {
                    ctx.putImageData(cleanSnapshot, 0, 0);
                }
                
                // 重新绘制当前线段（新位置）
                ctx.beginPath();
                ctx.moveTo(currentLine.startX, currentLine.startY);
                ctx.lineTo(currentLine.endX, currentLine.endY);
                ctx.strokeStyle = State.drawColor;
                ctx.lineWidth = State.drawWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = State.drawOpacity;
                ctx.stroke();
                
                // 如果是箭头，绘制箭头头部
                if (currentLine.tool === 'arrow') {
                    const angle = Math.atan2(currentLine.endY - currentLine.startY, 
                                           currentLine.endX - currentLine.startX);
                    const headLength = 15;
                    
                    ctx.beginPath();
                    ctx.moveTo(currentLine.endX, currentLine.endY);
                    ctx.lineTo(currentLine.endX - headLength * Math.cos(angle - Math.PI / 6), 
                              currentLine.endY - headLength * Math.sin(angle - Math.PI / 6));
                    ctx.lineTo(currentLine.endX - headLength * Math.cos(angle + Math.PI / 6), 
                              currentLine.endY - headLength * Math.sin(angle + Math.PI / 6));
                    ctx.closePath();
                    ctx.fillStyle = State.drawColor;
                    ctx.fill();
                }
            }
        },

        drawArrow: function(ctx, fromX, fromY, toX, toY) {
            const headLength = 15;
            const angle = Math.atan2(toY - fromY, toX - fromX);
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), 
                      toY - headLength * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), 
                      toY - headLength * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = State.drawColor;
            ctx.fill();
        },

        // 关键修复：显示线段控制点
        showLineHandles: function() {
            if (!currentLine) return;
            
            // 移除旧的控制点容器
            if (lineHandlesContainer) {
                lineHandlesContainer.remove();
            }
            
            // 创建新的控制点容器
            lineHandlesContainer = document.createElement('div');
            lineHandlesContainer.className = 'line-handles-container';
            lineHandlesContainer.style.position = 'absolute';
            lineHandlesContainer.style.top = '0';
            lineHandlesContainer.style.left = '0';
            lineHandlesContainer.style.width = '100%';
            lineHandlesContainer.style.height = '100%';
            lineHandlesContainer.style.pointerEvents = 'none';
            lineHandlesContainer.style.zIndex = '10001';
            
            // 获取图片元素
            const img = canvas.parentElement.querySelector('.modal-image');
            if (!img) return;
            
            // 计算缩放比例
            const scaleX = img.offsetWidth / canvas.width;
            const scaleY = img.offsetHeight / canvas.height;
            
            // 创建起点控制点
            const startHandle = document.createElement('div');
            startHandle.className = 'line-handle line-handle-start';
            startHandle.style.position = 'absolute';
            startHandle.style.width = '16px';
            startHandle.style.height = '16px';
            startHandle.style.borderRadius = '50%';
            startHandle.style.backgroundColor = '#FF0000';
            startHandle.style.border = '3px solid white';
            startHandle.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
            startHandle.style.cursor = 'move';
            startHandle.style.pointerEvents = 'auto';
            startHandle.style.left = (currentLine.startX * scaleX - 8) + 'px';
            startHandle.style.top = (currentLine.startY * scaleY - 8) + 'px';
            
            // 创建终点控制点
            const endHandle = document.createElement('div');
            endHandle.className = 'line-handle line-handle-end';
            endHandle.style.position = 'absolute';
            endHandle.style.width = '16px';
            endHandle.style.height = '16px';
            endHandle.style.borderRadius = '50%';
            endHandle.style.backgroundColor = '#FF0000';
            endHandle.style.border = '3px solid white';
            endHandle.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
            endHandle.style.cursor = 'move';
            endHandle.style.pointerEvents = 'auto';
            endHandle.style.left = (currentLine.endX * scaleX - 8) + 'px';
            endHandle.style.top = (currentLine.endY * scaleY - 8) + 'px';
            
            // 添加拖动事件
            let isDragging = false;
            let dragEndpoint = null;
            
            function handleMouseDown(e) {
                e.preventDefault();
                e.stopPropagation();
                isDragging = true;
                dragEndpoint = this.classList.contains('line-handle-start') ? 'start' : 'end';
                this.style.transform = 'scale(1.2)';
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }
            
            function handleMouseMove(e) {
                if (!isDragging || !currentLine) return;
                
                const rect = canvas.getBoundingClientRect();
                const relativeX = (e.clientX - rect.left) / rect.width;
                const relativeY = (e.clientY - rect.top) / rect.height;
                const newX = relativeX * canvas.width;
                const newY = relativeY * canvas.height;
                
                // 更新线段端点
                if (dragEndpoint === 'start') {
                    currentLine.startX = newX;
                    currentLine.startY = newY;
                } else {
                    currentLine.endX = newX;
                    currentLine.endY = newY;
                }
                
                // 重绘线段
                redrawLine();
                
                // 更新控制点位置
                const handle = dragEndpoint === 'start' ? startHandle : endHandle;
                handle.style.left = (newX * scaleX - 8) + 'px';
                handle.style.top = (newY * scaleY - 8) + 'px';
            }
            
            function handleMouseUp(e) {
                if (isDragging) {
                    isDragging = false;
                    startHandle.style.transform = 'scale(1)';
                    endHandle.style.transform = 'scale(1)';
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    
                    // 保存状态到历史
                    self.saveState();
                }
            }
            
            startHandle.addEventListener('mousedown', handleMouseDown);
            endHandle.addEventListener('mousedown', handleMouseDown);
            
            // 添加到容器
            lineHandlesContainer.appendChild(startHandle);
            lineHandlesContainer.appendChild(endHandle);
            
            // 将容器添加到图片父元素
            img.parentElement.appendChild(lineHandlesContainer);
        },

        // 重绘线段
        redrawLine: function() {
            if (!currentLine) return;
            
            const ctx = canvas.getContext('2d');
            
            // 清除整个canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 恢复之前的绘制（从历史记录）
            const history = State.drawingHistory[State.activeCanvasIndex];
            if (history && history.length > 0) {
                const lastState = history[history.length - 1];
                const img = new Image();
                img.onload = function() {
                    ctx.drawImage(img, 0, 0);
                    
                    // 重新绘制当前线段
                    ctx.beginPath();
                    ctx.moveTo(currentLine.startX, currentLine.startY);
                    ctx.lineTo(currentLine.endX, currentLine.endY);
                    ctx.strokeStyle = State.drawColor;
                    ctx.lineWidth = State.drawWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalAlpha = State.drawOpacity;
                    ctx.stroke();
                    
                    // 如果是箭头，绘制箭头头部
                    if (currentLine.tool === 'arrow') {
                        const angle = Math.atan2(currentLine.endY - currentLine.startY, 
                                               currentLine.endX - currentLine.startX);
                        const headLength = 15;
                        
                        ctx.beginPath();
                        ctx.moveTo(currentLine.endX, currentLine.endY);
                        ctx.lineTo(currentLine.endX - headLength * Math.cos(angle - Math.PI / 6), 
                                  currentLine.endY - headLength * Math.sin(angle - Math.PI / 6));
                        ctx.lineTo(currentLine.endX - headLength * Math.cos(angle + Math.PI / 6), 
                                  currentLine.endY - headLength * Math.sin(angle + Math.PI / 6));
                        ctx.closePath();
                        ctx.fillStyle = State.drawColor;
                        ctx.fill();
                    }
                };
                img.src = lastState;
            }
        },

        saveState: function() {
            if (!State.drawingHistory[State.activeCanvasIndex]) {
                State.drawingHistory[State.activeCanvasIndex] = [];
            }

            const canvas = State.layerCanvases[State.activeCanvasIndex];
            if (canvas && canvas.element) {
                State.drawingHistory[State.activeCanvasIndex].push(canvas.element.toDataURL());
                State.redoHistory[State.activeCanvasIndex] = [];
            }
        },

        restoreCanvas: function() {
            const canvas = State.layerCanvases[State.activeCanvasIndex];
            if (!canvas || !canvas.element) return;

            const history = State.drawingHistory[State.activeCanvasIndex];
            if (!history || history.length === 0) return;

            const img = new Image();
            const self = this;
            img.onload = function() {
                canvas.ctx.clearRect(0, 0, canvas.element.width, canvas.element.height);
                canvas.ctx.drawImage(img, 0, 0);
                if (window.refreshTextAnnotations) {
                    window.refreshTextAnnotations();
                }
            };
            img.src = history[history.length - 1];
        },

        updateAllCursors: function(cursorType) {
            State.layerCanvases.forEach(layer => {
                if (layer && layer.element) {
                    layer.element.style.cursor = cursorType;
                }
            });
        },

        enableAllCanvases: function() {
            console.log('=== enableAllCanvases ===');
            console.log('activeCanvasIndex:', State.activeCanvasIndex);
            State.layerCanvases.forEach((layer, index) => {
                if (layer && layer.element) {
                    const isActive = index === State.activeCanvasIndex;
                    layer.element.style.pointerEvents = isActive ? 'auto' : 'none';
                    // 关键修复：确保活动图层在最上层
                    layer.element.style.zIndex = isActive ? '1000' : index;
                    console.log(`Layer ${index}: pointerEvents = ${layer.element.style.pointerEvents}, zIndex = ${layer.element.style.zIndex}, isActive = ${isActive}`);
                }
            });
        },

        downloadAnnotated: function() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const img = modal.querySelector('.modal-image');
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0);
            
            State.layerCanvases.forEach((layer, index) => {
                if (layer && layer.element && State.layers[index].visible) {
                    ctx.drawImage(layer.element, 0, 0);
                }
            });

            const link = document.createElement('a');
            link.download = 'annotated-image-' + Date.now() + '.png';
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
            
            Utils.showNotification('图片已下载');
        }
    };
})();
