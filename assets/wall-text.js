// wall-text.js - 文字注释功能
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallText = {
        // 关键修复：将 handleConfirm 提升为公共方法，供 showEditInput 调用
        handleNewTextConfirm: function(modal) {
            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');
            const text = textInput.value.trim();
            if (text) {
                this.addAnnotation(text);
            }
            textInputContainer.style.display = 'none';
            textInput.value = '';
        },
        
        setupInput: function(modal) {
            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');
            const textConfirmBtn = modal.querySelector('.text-confirm-btn');

            // 关键修复：添加确认按钮的点击和触摸事件处理
            textConfirmBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.WallText.handleNewTextConfirm(modal);
            };

            // 关键修复：移动端触摸事件
            textConfirmBtn.addEventListener('touchend', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.WallText.handleNewTextConfirm(modal);
            }, { passive: false });

            textInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    textConfirmBtn.click();
                }
                if (e.key === 'Escape') {
                    textInputContainer.style.display = 'none';
                    textInput.value = '';
                }
            });
        },

        showInput: function(clientX, clientY) {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const textInputContainer = modal.querySelector('.text-input-container');
            const textInput = modal.querySelector('.text-annotation-input');

            // 获取图片元素
            const img = modal.querySelector('.modal-image');
            if (!img) return;

            // 关键修复：使用layers-container的位置
            const layersContainer = modal.querySelector('.layers-container');
            const containerRect = layersContainer.getBoundingClientRect();
            
            // 计算鼠标在container显示区域内的相对位置（0-1之间）
            const relativeX = (clientX - containerRect.left) / containerRect.width;
            const relativeY = (clientY - containerRect.top) / containerRect.height;
            
            // 转换为原始图片坐标（和图片原始尺寸相乘）
            const originalX = relativeX * img.naturalWidth;
            const originalY = relativeY * img.naturalHeight;

            console.log('=== 文字输入坐标调试 ===');
            console.log('鼠标位置:', clientX, clientY);
            console.log('layers-container位置:', containerRect.left, containerRect.top, containerRect.width, containerRect.height);
            console.log('图片原始尺寸:', img.naturalWidth, 'x', img.naturalHeight);
            console.log('相对位置:', relativeX.toFixed(4), relativeY.toFixed(4));
            console.log('State.scale:', State.currentScale);
            console.log('State.translate:', State.translateX, State.translateY);
            console.log('原始图片坐标:', originalX.toFixed(2), originalY.toFixed(2));

            // 输入框位置 - 相对于视口，使用固定定位
            textInputContainer.style.display = 'block';
            textInputContainer.style.position = 'fixed';
            textInputContainer.style.left = clientX + 'px';
            textInputContainer.style.top = clientY + 'px';
            textInputContainer.style.zIndex = '99999';
            textInputContainer.style.backgroundColor = 'white';
            textInputContainer.style.padding = '5px';
            textInputContainer.style.borderRadius = '3px';
            textInputContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
            
            textInput.value = '';
            
            textInputContainer.dataset.originalX = originalX;
            textInputContainer.dataset.originalY = originalY;
            
            console.log('输入框已显示:', textInputContainer.style.display);
            console.log('输入框位置:', clientX, clientY);
            
            setTimeout(function() {
                textInput.focus();
            }, 50);
        },

        addAnnotation: function(text) {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            const textInputContainer = modal.querySelector('.text-input-container');
            
            // 使用原始图片坐标
            const originalX = parseFloat(textInputContainer.dataset.originalX) || 0;
            const originalY = parseFloat(textInputContainer.dataset.originalY) || 0;

            const fontSize = State.drawWidth * 5 + 10;

            State.textAnnotations.push({
                layer: State.activeCanvasIndex,
                text: text,
                x: originalX,
                y: originalY,
                color: State.drawColor,
                size: fontSize,
                opacity: State.drawOpacity
            });

            // 关键修复：不再在Canvas上绘制，而是通过refreshTextAnnotations创建DOM元素
            if (window.refreshTextAnnotations) {
                window.refreshTextAnnotations();
            }
        },

        makeMovable: function() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;

            let selectedTextElement = null;
            let isDraggingText = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let initialLeft = 0;
            let initialTop = 0;

            // 文字容器在modal-image-container内，与layers-container平级
            let textContainer = modal.querySelector('.text-annotations-container');
            if (!textContainer) {
                textContainer = document.createElement('div');
                textContainer.className = 'text-annotations-container';
                textContainer.style.position = 'absolute';
                textContainer.style.top = '0';
                textContainer.style.left = '0';
                textContainer.style.width = '100%';
                textContainer.style.height = '100%';
                textContainer.style.pointerEvents = 'none';
                textContainer.style.zIndex = '100';
                textContainer.style.transformOrigin = '0 0';

                const container = modal.querySelector('.modal-image-container');
                container.appendChild(textContainer);
            }

            const self = this;

            function createTextElement(annotation, index) {
                const div = document.createElement('div');
                div.className = 'text-annotation-element';
                div.textContent = annotation.text;
                div.style.position = 'absolute';
                div.style.left = annotation.x + 'px';
                div.style.top = annotation.y + 'px';
                div.style.fontSize = annotation.size + 'px';
                div.style.color = annotation.color;
                div.style.fontFamily = 'Arial';
                div.style.pointerEvents = 'auto';
                div.style.cursor = 'move';
                div.style.userSelect = 'none';
                div.style.whiteSpace = 'nowrap';
                div.style.opacity = annotation.opacity || 1;
                div.style.lineHeight = '1';
                div.style.margin = '0';
                div.style.padding = '0';
                div.dataset.annotationIndex = index;

                return div;
            }

            // 关键修复：显示文字编辑输入框（长按1秒修改，2秒清空）
            function showEditInput(touch, annotationIndex, isEditMode) {
                const annotation = State.textAnnotations[annotationIndex];
                if (!annotation) return;
                
                const modal = document.getElementById('imageModal');
                const textInputContainer = modal.querySelector('.text-input-container');
                const textInput = modal.querySelector('.text-annotation-input');
                const textConfirmBtn = modal.querySelector('.text-confirm-btn');
                
                // 填充文字（修改模式保留原文字，清空模式为空）
                textInput.value = isEditMode ? annotation.text : '';
                
                // 显示输入框
                textInputContainer.style.display = 'block';
                textInputContainer.style.position = 'fixed';
                textInputContainer.style.left = (touch.clientX || 0) + 'px';
                textInputContainer.style.top = (touch.clientY || 0) + 'px';
                textInputContainer.style.zIndex = '99999';
                
                // 关键修复：移除所有旧的触摸监听器，避免叠加
                const newConfirmBtn = textConfirmBtn.cloneNode(true);
                if (textConfirmBtn.parentNode) {
                    textConfirmBtn.parentNode.replaceChild(newConfirmBtn, textConfirmBtn);
                }
                
                // 修改确认按钮的逻辑
                const handleEditConfirm = function() {
                    const newText = textInput.value.trim();
                    
                    console.log('=== handleEditConfirm ===');
                    console.log('annotationIndex:', annotationIndex);
                    console.log('isEditMode:', isEditMode);
                    console.log('newText:', newText);
                    console.log('State.textAnnotations.length:', State.textAnnotations.length);
                    console.log('annotation before:', State.textAnnotations[annotationIndex]);
                    
                    if (newText) {
                        // 更新文字内容
                        if (State.textAnnotations[annotationIndex]) {
                            State.textAnnotations[annotationIndex].text = newText;
                            console.log('Updated annotation:', State.textAnnotations[annotationIndex]);
                        } else {
                            console.error('ERROR: annotationIndex', annotationIndex, 'is out of bounds!');
                        }
                        // 重新渲染文字元素
                        if (window.refreshTextAnnotations) {
                            window.refreshTextAnnotations();
                        }
                    } else if (isEditMode) {
                        // 修改模式下如果输入为空，则删除该文字
                        console.log('Deleting annotation at index:', annotationIndex);
                        State.textAnnotations.splice(annotationIndex, 1);
                        console.log('After delete, length:', State.textAnnotations.length);
                        if (window.refreshTextAnnotations) {
                            window.refreshTextAnnotations();
                        }
                    }
                    // 清空模式：如果输入为空，文字已被删除
                    
                    textInputContainer.style.display = 'none';
                    textInput.value = '';
                    
                    console.log('Restoring confirm button to handleNewTextConfirm');
                    
                    // 关键修复：再次克隆按钮，彻底清除所有旧监听器
                    const finalConfirmBtn = newConfirmBtn.cloneNode(true);
                    if (newConfirmBtn.parentNode) {
                        newConfirmBtn.parentNode.replaceChild(finalConfirmBtn, newConfirmBtn);
                    }
                    
                    // 恢复确认按钮的原始逻辑
                    finalConfirmBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.WallText.handleNewTextConfirm(modal);
                    };
                    
                    finalConfirmBtn.addEventListener('touchend', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.WallText.handleNewTextConfirm(modal);
                    }, { passive: false });
                };
                
                // 临时修改确认按钮的行为
                newConfirmBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditConfirm();
                };
                
                // 关键修复：移动端需要添加触摸事件来阻止传播，避免触发其他事件
                newConfirmBtn.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditConfirm();
                }, { passive: false });
                
                // 点击输入框时阻止事件传播，避免触发拖动
                textInput.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                });
                
                textInput.addEventListener('touchstart', function(e) {
                    e.stopPropagation();
                }, { passive: false });
                
                setTimeout(function() {
                    // 关键修复：强制聚焦，移除可能的干扰
                    textInput.focus();
                    if (isEditMode) {
                        textInput.select(); // 修改模式：选中所有文字
                    }
                    // 再次尝试聚焦（解决某些浏览器的延迟问题）
                    setTimeout(function() {
                        textInput.focus();
                    }, 100);
                }, 50);
            }

            function refreshTextElements() {
                textContainer.innerHTML = '';

                State.textAnnotations.forEach(function(annotation, index) {
                    if (annotation.layer === State.activeCanvasIndex) {
                        const elem = createTextElement(annotation, index);

                        // 鼠标事件（桌面端）- 单击即可拖动，双击编辑
                        let mouseStartX = 0;
                        let mouseStartY = 0;
                        
                        elem.addEventListener('mousedown', function(e) {
                            if (State.currentTool !== 'select' && State.currentTool !== 'text') return;

                            // 右键菜单（保留原有功能）
                            if (e.button === 2) {
                                return;
                            }
                            
                            // 左键按下 - 立即准备拖动
                            if (e.button === 0) {
                                mouseStartX = e.clientX;
                                mouseStartY = e.clientY;
                                
                                // 视觉反馈：轻微放大文字
                                elem.style.transform = 'scale(1.08)';
                                elem.style.transition = 'transform 0.1s ease';
                            }

                            selectedTextElement = elem;
                            isDraggingText = true;
                            dragStartX = e.clientX;
                            dragStartY = e.clientY;
                            initialLeft = parseFloat(elem.style.left);
                            initialTop = parseFloat(elem.style.top);

                            e.stopPropagation();
                        });
                        
                        elem.addEventListener('mouseup', function(e) {
                            // 恢复文字大小
                            elem.style.transform = 'scale(1)';
                            
                            // 清理拖动状态
                            const modal = document.getElementById('imageModal');
                            const textInputContainer = modal ? modal.querySelector('.text-input-container') : null;
                            if (!textInputContainer || textInputContainer.style.display === 'none') {
                                isDraggingText = false;
                                selectedTextElement = null;
                            }
                            
                            e.stopPropagation();
                        });
                        
                        // 关键修复：双击编辑文字（桌面端）
                        elem.addEventListener('dblclick', function(e) {
                            if (State.currentTool !== 'select' && State.currentTool !== 'text') return;
                            
                            // 清除拖动状态，避免干扰
                            isDraggingText = false;
                            selectedTextElement = null;
                            
                            // 振动反馈（移动端）
                            if (navigator.vibrate) {
                                navigator.vibrate([30, 50, 30]);
                            }
                            
                            // 视觉反馈：放大文字
                            elem.style.transform = 'scale(1.15)';
                            elem.style.transition = 'transform 0.2s ease';
                            
                            // 显示输入框（修改模式）
                            showEditInput({clientX: e.clientX, clientY: e.clientY}, index, true);
                            
                            e.stopPropagation();
                            e.preventDefault();
                        });

                        // 关键修复：移动端触摸事件 - 长按拖动，双击编辑
                        let lastTapTime = 0;
                        let touchStartX = 0;
                        let touchStartY = 0;
                        let hasMoved = false;
                        let isTouchDragging = false;  // 标记是否正在触摸拖动
                        
                        elem.addEventListener('touchstart', function(e) {
                            if (State.currentTool !== 'select' && State.currentTool !== 'text') return;
                            
                            const touch = e.touches[0];
                            touchStartX = touch.clientX;
                            touchStartY = touch.clientY;
                            hasMoved = false;
                            isTouchDragging = false;
                            
                            // 视觉反馈：按下时立即放大文字
                            elem.style.transform = 'scale(1.15)';
                            elem.style.transition = 'transform 0.2s ease';
                            
                            // 振动反馈
                            if (navigator.vibrate) {
                                navigator.vibrate([30, 50, 30]);
                            }
                            
                            e.stopPropagation();
                        }, { passive: false });
                        
                        elem.addEventListener('touchmove', function(e) {
                            const touch = e.touches[0];
                            
                            // 如果还没有标记为移动状态，检查移动距离
                            if (!hasMoved) {
                                const moveDistance = Math.sqrt(
                                    Math.pow(touch.clientX - touchStartX, 2) + 
                                    Math.pow(touch.clientY - touchStartY, 2)
                                );
                                
                                if (moveDistance > 10) {
                                    hasMoved = true;
                                    isTouchDragging = true;
                                    // 开始拖动，设置初始位置（只设置一次）
                                    dragStartX = touch.clientX;
                                    dragStartY = touch.clientY;
                                    initialLeft = parseFloat(elem.style.left);
                                    initialTop = parseFloat(elem.style.top);
                                } else {
                                    // 移动距离不够，不处理
                                    return;
                                }
                            }
                            
                            // 只有确认拖动后才执行拖动逻辑
                            if (isTouchDragging) {
                                const deltaX = touch.clientX - dragStartX;
                                const deltaY = touch.clientY - dragStartY;
                                
                                // 考虑缩放比例
                                const scaledDeltaX = deltaX / State.currentScale;
                                const scaledDeltaY = deltaY / State.currentScale;
                                
                                const newLeft = initialLeft + scaledDeltaX;
                                const newTop = initialTop + scaledDeltaY;
                                
                                elem.style.left = newLeft + 'px';
                                elem.style.top = newTop + 'px';
                                
                                const annotationIndex = parseInt(elem.dataset.annotationIndex);
                                const annotation = State.textAnnotations[annotationIndex];
                                
                                annotation.x = newLeft;
                                annotation.y = newTop + annotation.size;
                            }
                            
                            // 只在事件可取消时才调用 preventDefault
                            if (e.cancelable) {
                                e.preventDefault();
                            }
                        }, { passive: false });
                        
                        elem.addEventListener('touchend', function(e) {
                            const currentTime = new Date().getTime();
                            const tapLength = currentTime - lastTapTime;
                            
                            // 检测双击（两次触摸间隔小于300ms且没有移动）
                            if (tapLength < 300 && tapLength > 0 && !hasMoved) {
                                if (State.currentTool !== 'select' && State.currentTool !== 'text') return;
                                
                                // 振动反馈
                                if (navigator.vibrate) {
                                    navigator.vibrate([30, 50, 30]);
                                }
                                
                                // 视觉反馈：放大文字
                                elem.style.transform = 'scale(1.15)';
                                elem.style.transition = 'transform 0.2s ease';
                                
                                // 显示输入框（修改模式）
                                const touch = e.changedTouches[0];
                                showEditInput({clientX: touch.clientX, clientY: touch.clientY}, index, true);
                            }
                            
                            lastTapTime = currentTime;
                            
                            // 清理拖动状态
                            isTouchDragging = false;
                            hasMoved = false;
                            
                            // 恢复文字大小
                            elem.style.transform = 'scale(1)';
                            
                            const modal = document.getElementById('imageModal');
                            const textInputContainer = modal ? modal.querySelector('.text-input-container') : null;
                            if (!textInputContainer || textInputContainer.style.display === 'none') {
                                isDraggingText = false;
                                selectedTextElement = null;
                            }
                            
                            e.stopPropagation();
                        });

                        textContainer.appendChild(elem);
                    }
                });
            }

            document.addEventListener('mousemove', function(e) {
                if (!isDraggingText || !selectedTextElement) return;

                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;

                // 考虑缩放比例
                const scaledDeltaX = deltaX / State.currentScale;
                const scaledDeltaY = deltaY / State.currentScale;

                const newLeft = initialLeft + scaledDeltaX;
                const newTop = initialTop + scaledDeltaY;

                selectedTextElement.style.left = newLeft + 'px';
                selectedTextElement.style.top = newTop + 'px';

                const index = parseInt(selectedTextElement.dataset.annotationIndex);
                const annotation = State.textAnnotations[index];
                
                annotation.x = newLeft;
                annotation.y = newTop + annotation.size;
            });

            document.addEventListener('mouseup', function() {
                if (isDraggingText) {
                    isDraggingText = false;
                    selectedTextElement = null;
                }
            });

            window.refreshTextAnnotations = refreshTextElements;
            refreshTextElements();
        }
    };
})();
