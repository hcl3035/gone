// wall-copy.js - 主入口文件
(function() {
    'use strict';

    function initWallCopy() {
        const textarea = document.getElementById('wallContent');
        if (!textarea) {
            console.warn('wallContent textarea not found');
            return;
        }

        const box = textarea.closest('.box');
        const wallImagePath = textarea.dataset.wallImagePath || '/wall-image/';

        // 初始化配置
        window.WallState.userId = window.WallUtils.generateId();
        window.WallState.currentDate = window.WallUtils.getCurrentDate();

        const savedCounter = localStorage.getItem('imgCounter_' + window.WallState.currentDate);
        if (savedCounter) {
            window.WallState.imageCounter = parseInt(savedCounter);
        }

        window.WallState.globalImageNumber = window.WallImage.countExistingImages(textarea.value);

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
                    window.WallUtils.showNotification('已复制选中内容');
                }).catch(function(err) {
                    console.error('Failed to copy: ', err);
                });
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

        // 初始化图片功能
        window.WallImage.init(textarea, box, wallImagePath);

        // 初始解析已有图片
        if (textarea.value) {
            setTimeout(function() {
                window.WallImage.parseExistingImages();
            }, 300);
        }

        // 监听表单提交事件
        const wallForm = document.getElementById('wallForm');
        if (wallForm) {
            wallForm.addEventListener('submit', function(e) {
                const imageMap = {};

                const previewImgs = document.querySelectorAll('.previewImage');
                previewImgs.forEach(function(img) {
                    const displayNum = img.dataset.displayNum;
                    const fileId = img.dataset.fileId;
                    if (displayNum && fileId) {
                        imageMap[displayNum] = fileId;
                    }
                });

                for (const key in window.WallState.imageStore) {
                    if (window.WallState.imageStore.hasOwnProperty(key)) {
                        const info = window.WallState.imageStore[key];
                        if (info.type === 'server' && info.fileId) {
                            const num = key.replace('#', '');
                            if (!imageMap[num]) {
                                imageMap[num] = info.fileId;
                            }
                        }
                    }
                }

                const imageMapInput = document.getElementById('wallImageMap');
                if (imageMapInput) {
                    imageMapInput.value = JSON.stringify(imageMap);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWallCopy);
    } else {
        initWallCopy();
    }
})();
