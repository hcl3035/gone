// wall-layers.js - 图层管理功能
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallLayers = {
        init: function(modal) {
            const layerManagerBtn = modal.querySelector('.layer-manager');
            if (layerManagerBtn) {
                layerManagerBtn.onclick = function() {
                    this.togglePanel(modal);
                }.bind(this);
            }
        },

        reinit: function() {
            const modal = document.getElementById('imageModal');
            if (modal) {
                window.WallDrawing.initLayers(modal);
                window.WallText.makeMovable();
            }
        },

        togglePanel: function(modal) {
            const panel = modal.querySelector('.layer-panel');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                this.renderList(modal);
            } else {
                panel.style.display = 'none';
            }
        },

        renderList: function(modal) {
            const layerList = modal.querySelector('.layer-list');
            layerList.innerHTML = '';

            State.layers.forEach((layer, index) => {
                const layerItem = document.createElement('div');
                layerItem.className = 'layer-item';
                if (index === State.activeCanvasIndex) {
                    layerItem.style.border = '2px solid #4CAF50';
                }
                layerItem.innerHTML = `
                    <input type="checkbox" ${layer.visible ? 'checked' : ''} class="layer-visible">
                    <span class="layer-name">${layer.name}</span>
                    <button class="layer-select" data-index="${index}" title="选中此图层">●</button>
                    <button class="layer-delete" data-index="${index}" title="删除图层">×</button>
                `;

                const visibleCheckbox = layerItem.querySelector('.layer-visible');
                visibleCheckbox.onchange = function() {
                    State.layers[index].visible = this.checked;
                    if (State.layerCanvases[index] && State.layerCanvases[index].element) {
                        State.layerCanvases[index].element.style.display = this.checked ? 'block' : 'none';
                    }
                };

                const selectBtn = layerItem.querySelector('.layer-select');
                selectBtn.onclick = function() {
                    State.activeCanvasIndex = index;
                    window.WallDrawing.enableAllCanvases();
                    this.renderList(modal);
                    Utils.showNotification('已切换到: ' + layer.name);
                }.bind(this);

                const deleteBtn = layerItem.querySelector('.layer-delete');
                deleteBtn.onclick = function() {
                    if (State.layers.length > 1) {
                        this.deleteLayer(index, modal);
                    } else {
                        Utils.showNotification('至少保留一个图层');
                    }
                }.bind(this);

                layerList.appendChild(layerItem);
            });

            const addLayerBtn = modal.querySelector('.add-layer-btn');
            addLayerBtn.onclick = function() {
                this.addLayer(modal);
            }.bind(this);

            const closeBtn = modal.querySelector('.close-layer-panel');
            closeBtn.onclick = function() {
                modal.querySelector('.layer-panel').style.display = 'none';
            };
        },

        addLayer: function(modal) {
            const newIndex = State.layers.length;
            State.layers.push({
                name: '图层 ' + (newIndex + 1),
                visible: true,
                locked: false
            });

            console.log('=== addLayer 调用前 ===');
            console.log('modal:', modal);
            console.log('modal type:', typeof modal, modal ? modal.tagName : 'null');
            console.log('newIndex:', newIndex);
            
            // 关键修复：创建新图层并绑定事件
            const newLayer = window.WallDrawing.createLayer(modal, newIndex);
            if (newLayer) {
                State.layerCanvases[newIndex] = newLayer;
                window.WallDrawing.bindCanvasEvents(newLayer.canvas, newIndex);
            }

            State.activeCanvasIndex = newIndex;
            window.WallDrawing.enableAllCanvases();

            this.renderList(modal);
            Utils.showNotification('已创建: 图层 ' + (newIndex + 1));
        },

        deleteLayer: function(index, modal) {
            if (State.layerCanvases[index] && State.layerCanvases[index].element) {
                State.layerCanvases[index].element.remove();
            }

            State.layers.splice(index, 1);
            State.layerCanvases.splice(index, 1);
            State.drawingHistory.splice(index, 1);
            State.redoHistory.splice(index, 1);

            if (State.activeCanvasIndex >= State.layers.length) {
                State.activeCanvasIndex = State.layers.length - 1;
            }

            this.rebuildCanvases(modal);
            this.renderList(modal);
            Utils.showNotification('图层已删除');
        },

        rebuildCanvases: function(modal) {
            const container = modal.querySelector('.layers-container');
            container.innerHTML = '';

            const oldCanvases = [...State.layerCanvases];
            State.layerCanvases = [];

            State.layers.forEach((layer, index) => {
                // 关键修复：传递正确的参数给createLayer
                window.WallDrawing.createLayer(modal, index);

                if (oldCanvases[index] && oldCanvases[index].element) {
                    const newCanvas = State.layerCanvases[index].element;
                    const newCtx = State.layerCanvases[index].ctx;
                    newCtx.drawImage(oldCanvases[index].element, 0, 0);
                    newCanvas.style.display = layer.visible ? 'block' : 'none';
                }
            });

            window.WallDrawing.enableAllCanvases();
        }
    };
})();
