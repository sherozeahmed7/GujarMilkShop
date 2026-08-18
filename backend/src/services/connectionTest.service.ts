export class ConnectionTestService {
  static async getSuccessMessage() {
    // Return the specific success message requested by the user
    return { message: 'Frontend Backend connection is successful!' };
  }
}
