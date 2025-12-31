"use strict";
const electron = require("electron");
const api = {
  notes: {
    create: (input) => electron.ipcRenderer.invoke("notes:create", input),
    get: (id) => electron.ipcRenderer.invoke("notes:get", id),
    update: (input) => electron.ipcRenderer.invoke("notes:update", input),
    delete: (id) => electron.ipcRenderer.invoke("notes:delete", id),
    archive: (id) => electron.ipcRenderer.invoke("notes:archive", id),
    restore: (id) => electron.ipcRenderer.invoke("notes:restore", id),
    duplicate: (id) => electron.ipcRenderer.invoke("notes:duplicate", id),
    list: (options) => electron.ipcRenderer.invoke("notes:list", options),
    search: (query, limit) => electron.ipcRenderer.invoke("notes:search", query, limit),
    tags: () => electron.ipcRenderer.invoke("notes:tags"),
    count: () => electron.ipcRenderer.invoke("notes:count")
  },
  app: {
    version: () => "0.1.0"
  }
};
electron.contextBridge.exposeInMainWorld("readied", api);
