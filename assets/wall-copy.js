(function() {
    // 图片计数器（基于当天日期）
    let imageCounter = 0;
    let currentDate = '';
    
    // 当前查看的图片索引、缩放比例和拖拽状态
    let currentImageIndex = 0;
    let currentScale = 1;
    let allImages = [];
    
    // 拖拽相关变量
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;

    function initWallCopy() {
        const textarea = document.getElementById('wallContent');
        if (!textarea) {
            console.warn('wallContent textarea not found');
            return;
        }

        const box = textarea.closest('.box');

        // 初始化日期和计数器
        const today = new Date();
        currentDate = today.getFullYear().toString().substr(-2) + 
                      String(today.getMonth() + 1).padStart(2, '0') + 
                      String(today.getDate()).padStart(2, '0');
        
        // 从 sessionStorage 恢复计数器
        const savedCounter = sessionStorage.getItem('imgCounter_' + currentDate);
        if (savedCounter) {
            imageCounter = parseInt(savedCounter);
        }

        // 复制功能
        textarea.addEventListener('mouseup', function() {
            const selectedText = textarea.value.substring(
                textarea.selectionStart,
                textarea.selectionEnd
            );

            if (!selectedText || selectedText.trim() === '') {
                return;
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(selectedText).then(function() {
                    showCopyNotification();
                }).catch(function(err) {
                    console.error('Failed to copy: ', err);
                    fallbackCopy(selectedText);
                });
            } else {
                fallbackCopy(selectedText);
            }
        });

        // 粘贴图片功能
        textarea.addEventListener('paste', function(e) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    
                    reader.onload = function(event) {
                        const base64String = event.target.result;
                        
                        // 生成简短ID：日期+序号 (例如: 260115_1)
                        imageCounter++;
                        const imageId = currentDate + '_' + imageCounter;
                        
                        // 保存到 sessionStorage
                        sessionStorage.setItem('imgCounter_' + currentDate, imageCounter.toString());
                        
                        // 在光标位置插入超简短的图片标记
                        const startPos = textarea.selectionStart;
                        const endPos = textarea.selectionEnd;
                        const text = textarea.value;
                        
                        const imageMarkdown = '\n![' + imageId + ']\n';
                        
                        textarea.value = text.substring(0, startPos) + imageMarkdown + text.substring(endPos);
                        
                        // 移动光标到图片标记后面
                        const newPos = startPos + imageMarkdown.length;
                        textarea.setSelectionRange(newPos, newPos);
                        
                        // 渲染图片预览
                        renderImagePreview(imageId, base64String);
                        
                        showCopyNotification('已粘贴图片');
                        
                        // 触发 input 事件
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    };
                    
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        });

        // 监听textarea的resize事件，同步调整box宽度
        let isResizing = false;
        let animationFrameId = null;
        let lastBoxWidth = 0;

        function updateBoxWidth() {
            if (isResizing && box) {
                const textareaWidth = textarea.offsetWidth;
                const boxPadding = 32;
                const newWidth = textareaWidth + boxPadding;
                
                if (Math.abs(newWidth - lastBoxWidth) > 2) {
                    box.style.width = newWidth + 'px';
                    lastBoxWidth = newWidth;
                }
            }
            animationFrameId = requestAnimationFrame(updateBoxWidth);
        }

        textarea.addEventListener('mousedown', function() {
            isResizing = true;
            lastBoxWidth = box ? box.offsetWidth : 0;
            if (!animationFrameId) {
                updateBoxWidth();
            }
        });

        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        });

        // 窗口大小改变时重置textarea和box尺寸
        let windowResizeTimeout;
        
        window.addEventListener('resize', function() {
            clearTimeout(windowResizeTimeout);
            
            windowResizeTimeout = setTimeout(function() {
                textarea.style.width = '';
                textarea.style.height = '';
                if (box) {
                    box.style.width = '';
                }
                lastBoxWidth = 0;
            }, 50);
        });

        function fallbackCopy(text) {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = text;
            tempTextarea.style.position = 'fixed';
            tempTextarea.style.left = '-9999px';
            document.body.appendChild(tempTextarea);
            tempTextarea.select();

            try {
                document.execCommand('copy');
                showCopyNotification();
            } catch (err) {
                console.error('Fallback copy failed: ', err);
            }

            document.body.removeChild(tempTextarea);
        }

        function showCopyNotification(message) {
            let notification = document.getElementById('copyNotification');
            if (!notification) {
                notification = document.createElement('div');
                notification.id = 'copyNotification';
                notification.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #4CAF50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                document.body.appendChild(notification);
            }

            notification.textContent = message || '已复制选中内容';
            notification.style.opacity = '1';
            setTimeout(function() {
                notification.style.opacity = '0';
            }, 1500);
        }

        // 渲染图片预览
        function renderImagePreview(imageId, base64String) {
            // 创建或获取预览容器
            let previewContainer = document.getElementById('imagePreviewContainer');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'imagePreviewContainer';
                previewContainer.className = 'imagePreviewContainer';
                
                // 将预览容器插入到 textarea 后面
                textarea.parentNode.insertBefore(previewContainer, textarea.nextSibling);
            }

            // 创建图片元素
            const img = document.createElement('img');
            img.src = base64String;
            img.alt = 'Image ' + imageId;
            img.title = '点击查看原图';
            img.className = 'previewImage';
            img.dataset.imageId = imageId;
            img.dataset.base64 = base64String;
            
            // 点击图片查看原图
            img.onclick = function() {
                openImageModal(base64String, imageId);
            };
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'deleteImageButton';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '删除图片';
            deleteBtn.onclick = function() {
                // 从 textarea 中移除对应的标记
                const pattern = new RegExp('\\n!\\[' + imageId + '\\]\\n', 'g');
                textarea.value = textarea.value.replace(pattern, '\n');
                
                // 移除预览图片
                wrapper.remove();
                
                // 如果容器为空，移除容器
                if (previewContainer.children.length === 0) {
                    previewContainer.remove();
                }
                
                showCopyNotification('已删除图片');
            };
            
            // 创建包装器
            const wrapper = document.createElement('div');
            wrapper.className = 'imageWrapper';
            wrapper.appendChild(img);
            wrapper.appendChild(deleteBtn);
            
            previewContainer.appendChild(wrapper);
        }

        // 打开图片模态框
        function openImageModal(base64String, imageId) {
            // 收集所有图片
            allImages = [];
            const previewImgs = document.querySelectorAll('.previewImage');
            previewImgs.forEach(function(img, index) {
                allImages.push({
                    id: img.dataset.imageId,
                    src: img.dataset.base64
                });
                if (img.dataset.imageId === imageId) {
                    currentImageIndex = index;
                }
            });
            
            // 重置缩放和位置
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            
            // 创建或获取模态框
            let modal = document.getElementById('imageModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'imageModal';
                modal.className = 'imageModal';
                modal.innerHTML = `
                    <div class="modal-toolbar">
                        <button class="toolbar-btn zoom-in" title="放大">+</button>
                        <button class="toolbar-btn zoom-out" title="缩小">−</button>
                        <button class="toolbar-btn zoom-reset" title="重置">⟲</button>
                        <span class="zoom-level">100%</span>
                    </div>
                    <span class="modal-close">&times;</span>
                    <button class="modal-nav modal-prev">&#10094;</button>
                    <div class="modal-image-container">
                        <img class="modal-image" src="" alt="Original Image">
                    </div>
                    <button class="modal-nav modal-next">&#10095;</button>
                    <div class="modal-caption"></div>
                `;
                document.body.appendChild(modal);
                
                // 绑定事件
                modal.querySelector('.modal-close').onclick = closeModal;
                modal.querySelector('.modal-prev').onclick = showPrevImage;
                modal.querySelector('.modal-next').onclick = showNextImage;
                modal.querySelector('.zoom-in').onclick = zoomIn;
                modal.querySelector('.zoom-out').onclick = zoomOut;
                modal.querySelector('.zoom-reset').onclick = resetZoom;
                
                // 点击背景关闭
                modal.onclick = function(e) {
                    if (e.target === modal) {
                        closeModal();
                    }
                };
                
                // 滚轮缩放
                const imgContainer = modal.querySelector('.modal-image-container');
                imgContainer.addEventListener('wheel', function(e) {
                    e.preventDefault();
                    if (e.deltaY < 0) {
                        zoomIn();
                    } else {
                        zoomOut();
                    }
                });
                
                // 拖拽功能
                const img = modal.querySelector('.modal-image');
                
                img.addEventListener('mousedown', function(e) {
                    if (currentScale > 1) {
                        isDragging = true;
                        startX = e.clientX - translateX;
                        startY = e.clientY - translateY;
                        img.style.cursor = 'grabbing';
                        e.preventDefault();
                    }
                });
                
                document.addEventListener('mousemove', function(e) {
                    if (isDragging) {
                        translateX = e.clientX - startX;
                        translateY = e.clientY - startY;
                        applyTransform();
                    }
                });
                
                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                        isDragging = false;
                        img.style.cursor = 'grab';
                    }
                });
                
                // 键盘事件
                document.addEventListener('keydown', handleKeyDown);
            }
            
            // 显示模态框
            modal.style.display = 'flex';
            updateModalImage();
        }

        // 更新模态框图片
        function updateModalImage() {
            const modal = document.getElementById('imageModal');
            if (!modal || allImages.length === 0) return;
            
            const img = modal.querySelector('.modal-image');
            const caption = modal.querySelector('.modal-caption');
            const prevBtn = modal.querySelector('.modal-prev');
            const nextBtn = modal.querySelector('.modal-next');
            const zoomLevel = modal.querySelector('.zoom-level');
            
            img.src = allImages[currentImageIndex].src;
            caption.textContent = 'Image ' + allImages[currentImageIndex].id + ' (' + (currentImageIndex + 1) + '/' + allImages.length + ')';
            
            // 显示/隐藏导航按钮
            prevBtn.style.display = allImages.length > 1 ? 'block' : 'none';
            nextBtn.style.display = allImages.length > 1 ? 'block' : 'none';
            
            // 更新缩放显示
            zoomLevel.textContent = Math.round(currentScale * 100) + '%';
            
            // 应用变换
            applyTransform();
        }

        // 应用缩放和位移
        function applyTransform() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const img = modal.querySelector('.modal-image');
            img.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + currentScale + ')';
            
            const zoomLevel = modal.querySelector('.zoom-level');
            zoomLevel.textContent = Math.round(currentScale * 100) + '%';
        }

        // 放大
        function zoomIn() {
            currentScale = Math.min(currentScale + 0.25, 5);
            applyTransform();
        }

        // 缩小
        function zoomOut() {
            currentScale = Math.max(currentScale - 0.25, 0.25);
            // 如果缩小到1倍以下，重置位置
            if (currentScale <= 1) {
                translateX = 0;
                translateY = 0;
            }
            applyTransform();
        }

        // 重置缩放
        function resetZoom() {
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            applyTransform();
        }

        // 显示上一张图片
        function showPrevImage() {
            if (allImages.length <= 1) return;
            currentImageIndex = (currentImageIndex - 1 + allImages.length) % allImages.length;
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            updateModalImage();
        }

        // 显示下一张图片
        function showNextImage() {
            if (allImages.length <= 1) return;
            currentImageIndex = (currentImageIndex + 1) % allImages.length;
            currentScale = 1;
            translateX = 0;
            translateY = 0;
            updateModalImage();
        }

        // 关闭模态框
        function closeModal() {
            const modal = document.getElementById('imageModal');
            if (modal) {
                modal.style.display = 'none';
            }
        }

        // 键盘事件处理
        function handleKeyDown(e) {
            const modal = document.getElementById('imageModal');
            if (modal && modal.style.display === 'block') {
                if (e.key === 'Escape') closeModal();
                if (e.key === 'ArrowLeft') showPrevImage();
                if (e.key === 'ArrowRight') showNextImage();
                if (e.key === '+' || e.key === '=') zoomIn();
                if (e.key === '-') zoomOut();
                if (e.key === '0') resetZoom();
            }
        }

        // 页面加载时，解析已有的图片并显示预览
        function parseExistingImages() {
            const content = textarea.value;
            const imagePattern = /!\[(\d{6}_\d+)\]\n/g;
            let match;
            
            // 收集所有图片标记
            const imageIds = [];
            while ((match = imagePattern.exec(content)) !== null) {
                imageIds.push(match[1]);
            }
            
            // 从 sessionStorage 获取并渲染图片
            imageIds.forEach(function(imageId) {
                const base64String = sessionStorage.getItem(imageId);
                if (base64String) {
                    renderImagePreview(imageId, base64String);
                }
            });
        }

        // 初始解析已有图片
        if (textarea.value) {
            setTimeout(parseExistingImages, 100);
        }
        
        // 在表单提交前，保存图片数据到 sessionStorage
        const form = document.getElementById('wallForm');
        if (form) {
            form.addEventListener('submit', function(e) {
                // 收集所有图片的 Base64 数据并保存到 sessionStorage
                const previewImgs = document.querySelectorAll('.previewImage');
                previewImgs.forEach(function(img) {
                    const imageId = img.dataset.imageId;
                    const base64Data = img.dataset.base64;
                    if (imageId && base64Data) {
                        sessionStorage.setItem(imageId, base64Data);
                    }
                });
                
                console.log('Saved', previewImgs.length, 'images to sessionStorage');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWallCopy);
    } else {
        initWallCopy();
    }
})();