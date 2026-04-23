const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    
    socket.on('join_project', (projectId) => {
      socket.join(projectId);
    });

    socket.on('leave_project', (projectId) => {
      socket.leave(projectId);
    });

    socket.on('disconnect', () => {
    });
  });
};

export default initializeSocket;