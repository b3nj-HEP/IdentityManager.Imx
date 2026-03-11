import { Component } from '@angular/core';
import { SplashService } from '../../splash/splash.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'axpo-splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ opacity: '0' }),
        animate('200ms ease-in', style({ opacity: '1' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(-100%)' }))
      ])
    ])
  ],
  imports: [CommonModule],
  standalone: true
})

/* 
  2023/04/21 flofiedler: implemented this components because the default SplashScreen can hardly be overwritten.
  State of the component is controlled through qbm/splashService. Following attributes can be set:
    - isActive (bool: controlls open/close state of the overlay)
    - showLoadingindicator (bool: if set to yes, three animated dots are displayed)
    - applicationName: (string: name of the application to be shown, default "One Identity Manager", set in the projects appconfig.json)
    - message (string: the message to be displayed/current task)
*/

export class SplashScreenComponent {
  constructor(public splashService: SplashService) { }
}
