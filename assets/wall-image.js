// wall-image.js - 图片上传、预览、查看器
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    // 初始化图片功能
    window.WallImage = {
        init: function(textarea, box, wallImagePath) {
            this.textarea = textarea;
            this.box = box;
            this.wallImagePath = wallImagePath;
            this.bindEvents();
        },

        bindEvents: function() {
            const self = this;
            
            // 粘贴图片
            this.textarea.addEventListener('paste', function(e) {
                self.handlePaste(e);
            });
        },

        handlePaste: function(e) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    
                    const blob = items[i].getAsFile();
                    State.globalImageNumber++;
                    const imageNum = State.globalImageNumber;
                    
                    State.imageCounter++;
                    const tempId = State.currentDate + '_' + State.imageCounter;
                    localStorage.setItem('imgCounter_' + State.currentDate, State.imageCounter.toString());
                    
                    const tempUrl = URL.createObjectURL(blob);
                    
                    // 插入标记
                    const startPos = this.textarea.selectionStart;
                    const endPos = this.textarea.selectionEnd;
                    const text = this.textarea.value;
                    const imageMarkdown = '📷' + imageNum;
                    
                    this.textarea.value = text.substring(0, startPos) + imageMarkdown + text.substring(endPos);
                    const newPos = startPos + imageMarkdown.length;
                    this.textarea.setSelectionRange(newPos, newPos);
                    
                    State.imageStore['#' + imageNum] = { url: tempUrl, type: 'temp', tempId: tempId };
                    this.renderPreview('#' + imageNum, tempUrl);
                    Utils.showNotification('正在上传图片...');
                    
                    // 上传到服务器
                    this.uploadImage(blob, tempId, imageNum);
                    break;
                }
            }
        },

        uploadImage: function(blob, tempId, imageNum) {
            const self = this;
            const formData = new FormData();
            formData.append('file', blob, tempId + '.png');
            formData.append('downloads', '9999');
            formData.append('duration', '168h');
            
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(function(response) {
                if (!response.ok) throw new Error('Upload failed');
                return response.json();
            })
            .then(function(data) {
                if (data && data.length > 0 && data[0].id) {
                    const fileId = data[0].id;
                    State.uploadedImages['#' + imageNum] = fileId;
                    State.imageStore['#' + imageNum] = { 
                        url: self.wallImagePath + fileId, 
                        type: 'server', 
                        fileId: fileId 
                    };
                    
                    const previewImg = document.querySelector(`img[data-image-id="#${imageNum}"]`);
                    if (previewImg) {
                        previewImg.src = self.wallImagePath + fileId;
                        previewImg.dataset.imageUrl = self.wallImagePath + fileId;
                        previewImg.dataset.fileId = fileId;
                        previewImg.dataset.displayNum = imageNum.toString();
                    }
                    
                    Utils.showNotification('图片上传成功');
                    self.textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            })
            .catch(function(error) {
                console.error('Upload error:', error);
                Utils.showNotification('图片上传失败');
            });
        },

        renderPreview: function(imageKey, imageUrl) {
            let previewContainer = document.getElementById('imagePreviewContainer');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'imagePreviewContainer';
                previewContainer.className = 'imagePreviewContainer';
                this.textarea.parentNode.insertBefore(previewContainer, this.textarea.nextSibling);
            }

            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Image ' + imageKey;
            img.title = '点击查看原图';
            img.className = 'previewImage';
            img.dataset.imageId = imageKey;
            img.dataset.imageUrl = imageUrl;
            
            img.onclick = function() {
                window.WallViewer.open(imageUrl, imageKey);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'deleteImageButton';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '删除图片';
            deleteBtn.onclick = function() {
                const pattern = new RegExp('📷' + imageKey.replace('#', '') + '(?!\\d)', 'g');
                window.WallImage.textarea.value = window.WallImage.textarea.value.replace(pattern, '');
                wrapper.remove();
                if (previewContainer.children.length === 0) {
                    previewContainer.remove();
                }
                delete State.imageStore[imageKey];
                Utils.showNotification('已删除图片');
            };
            
            const wrapper = document.createElement('div');
            wrapper.className = 'imageWrapper';
            wrapper.appendChild(img);
            wrapper.appendChild(deleteBtn);
            previewContainer.appendChild(wrapper);
        },

        // 统计已有图片数量
        countExistingImages: function(content) {
            const pattern = /📷(\d+)/g;
            let match;
            let maxNum = 0;
            while ((match = pattern.exec(content)) !== null) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
            return maxNum;
        },

        // 解析已有图片
        parseExistingImages: function() {
            const content = this.textarea.value;
            const pattern = /📷(\d+)/g;
            let match;
            const imageNums = [];
            
            while ((match = pattern.exec(content)) !== null) {
                const num = match[1];
                if (!imageNums.includes(num)) imageNums.push(num);
            }
            
            if (imageNums.length > 0) {
                this.loadWallImageMapping(imageNums);
            }
        },

        // 加载图片映射
        loadWallImageMapping: function(imageNums) {
            const mapDataElement = document.getElementById('wallImageMapData');
            if (!mapDataElement) return;
            
            let imageMap = {};
            try {
                const mapJson = mapDataElement.textContent.trim();
                if (mapJson && mapJson !== '{}') {
                    imageMap = JSON.parse(mapJson);
                }
            } catch(e) {
                console.error('Failed to parse image map:', e);
                return;
            }
            
            if (Object.keys(imageMap).length === 0) return;
            
            const self = this;
            imageNums.forEach(function(num) {
                const fileId = imageMap[num];
                if (fileId) {
                    const imageUrl = self.wallImagePath + fileId;
                    const imageKey = '#' + num;
                    State.imageStore[imageKey] = { url: imageUrl, type: 'server', fileId: fileId };
                    
                    const testImg = new Image();
                    testImg.onload = function() {
                        self.renderPreview(imageKey, imageUrl);
                        const img = document.querySelector(`img[data-file-id="${fileId}"]`);
                        if (img) img.dataset.displayNum = num;
                    };
                    testImg.src = imageUrl;
                }
            });
        }
    };
})();
